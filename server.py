from __future__ import annotations

import asyncio
import base64
import copy
import io
import json
import re
import secrets
import os
import hmac
import hashlib
import socket
import sqlite3
import sys
import time
import webbrowser
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit

from aiohttp import WSMsgType, web
import qrcode

ROOT = Path(__file__).resolve().parent
INDEX_PATH = ROOT / "index.html"
DATA_DIR = Path(os.getenv("MOTHERSHIP_DATA_DIR", str(ROOT))).expanduser().resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "mothership_data.sqlite3"
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8877"))
TEACHER_KEY = "5030"  # Pilot teacher login key; intentionally fixed for this build.
_EXPLICIT_PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").strip().rstrip("/")
_RAILWAY_PUBLIC_DOMAIN = os.getenv("RAILWAY_PUBLIC_DOMAIN", "").strip().strip("/")
PUBLIC_BASE_URL = _EXPLICIT_PUBLIC_BASE_URL or (f"https://{_RAILWAY_PUBLIC_DOMAIN}" if _RAILWAY_PUBLIC_DOMAIN else "")
NO_BROWSER = os.getenv("MOTHERSHIP_NO_BROWSER", "").strip().lower() in {"1", "true", "yes", "on"}
JOIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
APP_VERSION = "52.0"

PUBLIC_STORAGE_KEYS = {
    "siMothership.customAvatars.v1",
    "siMothership.rosterSets.v1",
    "siMothership.activeRosterSet.v1",
}

PERSISTED_STORAGE_KEYS = {
    "siMothership.customAvatars.v1",
    "siMothership.rosterSets.v1",
    "siMothership.activeRosterSet.v1",
    "siMothership.presentations.v1",
    "siMothership.vectorActivities.v1",
    "siMothership.boardSessions.v1",
    "siMothership.orbitActivities.v1",
    "siMothership.pixelRevealActivities.v1",
    "siMothership.sketchWordPacks.v1",
    "siMothership.starwheelPuzzlePacks.v1",
    "siMothership.appShortcuts.v1",
    "siMothership.activityPresets.v1",
    "siMothership.recentActivities.v1",
    "siMothership.sessionHistory.v1",
}

CLIENTS: set[web.WebSocketResponse] = set()
CLIENT_META: dict[web.WebSocketResponse, dict] = {}
LATEST_STATE: Optional[dict] = None
CURRENT_JOIN_CODE = ""
CURRENT_SESSION_ID = ""


def db() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH, timeout=15)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    con.execute("PRAGMA busy_timeout=15000")
    return con


def init_db() -> None:
    global LATEST_STATE, CURRENT_JOIN_CODE, CURRENT_SESSION_ID
    with db() as con:
        con.execute("PRAGMA journal_mode=WAL")
        con.execute(
            """CREATE TABLE IF NOT EXISTS server_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )"""
        )
        con.execute(
            """CREATE TABLE IF NOT EXISTS teacher_kv (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at REAL NOT NULL
            )"""
        )
        con.execute(
            """CREATE TABLE IF NOT EXISTS runtime (
                id INTEGER PRIMARY KEY CHECK(id=1),
                join_code TEXT NOT NULL,
                session_id TEXT,
                state_json TEXT,
                updated_at REAL NOT NULL
            )"""
        )
        cols = {r[1] for r in con.execute("PRAGMA table_info(runtime)").fetchall()}
        if "session_id" not in cols:
            con.execute("ALTER TABLE runtime ADD COLUMN session_id TEXT")
        row = con.execute("SELECT join_code,session_id,state_json FROM runtime WHERE id=1").fetchone()
        if row is None:
            CURRENT_JOIN_CODE = new_join_code()
            CURRENT_SESSION_ID = new_session_id()
            con.execute(
                "INSERT INTO runtime(id,join_code,session_id,state_json,updated_at) VALUES(1,?,?,?,?)",
                (CURRENT_JOIN_CODE, CURRENT_SESSION_ID, None, time.time()),
            )
            LATEST_STATE = None
        else:
            CURRENT_JOIN_CODE = row["join_code"]
            CURRENT_SESSION_ID = row["session_id"] or new_session_id()
            if not row["session_id"]:
                con.execute("UPDATE runtime SET session_id=? WHERE id=1", (CURRENT_SESSION_ID,))
            try:
                LATEST_STATE = json.loads(row["state_json"]) if row["state_json"] else None
            except Exception:
                LATEST_STATE = None


def new_join_code() -> str:
    return "".join(secrets.choice(JOIN_ALPHABET) for _ in range(4))


def new_session_id() -> str:
    return secrets.token_urlsafe(9)


def save_runtime_state(state: Optional[dict]) -> None:
    global LATEST_STATE
    LATEST_STATE = state
    payload = json.dumps(state, separators=(",", ":")) if state is not None else None
    with db() as con:
        con.execute(
            "UPDATE runtime SET state_json=?,updated_at=? WHERE id=1",
            (payload, time.time()),
        )


def rotate_session() -> str:
    global CURRENT_JOIN_CODE, CURRENT_SESSION_ID, LATEST_STATE
    CURRENT_JOIN_CODE = new_join_code()
    CURRENT_SESSION_ID = new_session_id()
    LATEST_STATE = None
    with db() as con:
        con.execute(
            "UPDATE runtime SET join_code=?,session_id=?,state_json=NULL,updated_at=? WHERE id=1",
            (CURRENT_JOIN_CODE, CURRENT_SESSION_ID, time.time()),
        )
    return CURRENT_JOIN_CODE




def _student_by_identity(state: dict, token: str = "", name: str = "") -> Optional[dict]:
    students = state.get("students") if isinstance(state, dict) else None
    if not isinstance(students, list):
        return None
    if token:
        for st in students:
            if isinstance(st, dict) and str(st.get("studentToken", "")) == token:
                return st
    if name:
        for st in students:
            if isinstance(st, dict) and str(st.get("n", "")) == name:
                return st
    return None


def _state_for_role(state: dict, role: str, token: str = "", name: str = "") -> dict:
    """Return the classroom state appropriate for one connected client.

    Teacher sockets receive the canonical state. Shared screens never receive
    teacher-private inbox payloads. Student sockets receive only their own
    private messages/photos/responses while retaining the common classroom and
    activity state needed to render the experience.
    """
    if not isinstance(state, dict):
        return state
    if role == "teacher":
        return state

    out = copy.deepcopy(state)
    role = str(role or "")
    token = str(token or "")
    name = str(name or "")
    own = None
    if role == "student":
        # Student-private state requires the established token. Name-only fallback
        # is allowed only for legacy records that genuinely have no token.
        if token:
            own = _student_by_identity(out, token, "")
        if own is None and name:
            legacy = _student_by_identity(out, "", name)
            if isinstance(legacy, dict) and not str(legacy.get("studentToken") or ""):
                own = legacy
    own_name = str(own.get("n", "")) if isinstance(own, dict) else ""
    own_token = str(own.get("studentToken", "")) if isinstance(own, dict) else ""

    students = out.get("students", [])
    if isinstance(students, list):
        for st in students:
            if not isinstance(st, dict):
                continue
            is_self = role == "student" and (
                (own_token and str(st.get("studentToken", "")) == own_token)
                or (own_name and str(st.get("n", "")) == own_name)
            )
            if not is_self:
                st.pop("studentToken", None)
            if role == "student" and not is_self:
                st.pop("readyResponse", None)
                st.pop("emotion", None)
                st.pop("understanding", None)

    run = out.get("activityRun")
    if isinstance(run, dict) and str(run.get("activityId") or "") == "starwheel-game":
        sw = run.get("starwheel")
        if isinstance(sw, dict):
            sw.pop("pendingSolve", None)
            sw.pop("lastRequestId", None)
        run.pop("starwheelRequest", None)

    if role != "student":
        # Shared/unknown non-teacher clients receive display-safe state only.
        out["buzz"] = []
        out["help"] = []
        out["helpMessages"] = []
        out["helpDeletedIds"] = []
        out["alerts"] = []
        out["photos"] = []
        return out

    out["buzz"] = [x for x in out.get("buzz", []) if x == own_name] if isinstance(out.get("buzz"), list) else []
    out["help"] = [x for x in out.get("help", []) if x == own_name] if isinstance(out.get("help"), list) else []
    out["alerts"] = [
        a for a in out.get("alerts", [])
        if isinstance(a, dict) and str(a.get("name", "")) == own_name
    ] if isinstance(out.get("alerts"), list) else []
    out["helpMessages"] = [
        m for m in out.get("helpMessages", [])
        if isinstance(m, dict) and str(m.get("name", "")) == own_name
    ] if isinstance(out.get("helpMessages"), list) else []
    out["helpDeletedIds"] = []
    out["photos"] = [
        p for p in out.get("photos", [])
        if isinstance(p, dict) and str(p.get("name", "")) == own_name
    ] if isinstance(out.get("photos"), list) else []

    run = out.get("activityRun")
    if isinstance(run, dict):
        if str(run.get("activityId") or "") == "starwheel-game":
            cfg = run.get("starwheelConfig")
            if isinstance(cfg, dict):
                cfg.pop("answer", None)
            run.pop("starwheelRequest", None)
        responses = run.get("responses")
        if isinstance(responses, dict):
            filtered = {}
            for slide_key, response_map in responses.items():
                if isinstance(response_map, dict) and own_name in response_map:
                    filtered[str(slide_key)] = {own_name: copy.deepcopy(response_map[own_name])}
                elif isinstance(response_map, dict):
                    filtered[str(slide_key)] = {}
            run["responses"] = filtered

        for field in ("vectorResponses", "orbitResponses", "pixelGuesses"):
            mapping = run.get(field)
            if isinstance(mapping, dict):
                run[field] = {own_name: copy.deepcopy(mapping[own_name])} if own_name in mapping else {}

        sketch = run.get("sketch")
        if isinstance(sketch, dict) and isinstance(sketch.get("guesses"), dict):
            guesses = sketch["guesses"]
            sketch["guesses"] = {own_name: copy.deepcopy(guesses[own_name])} if own_name in guesses else {}

    return out


async def _send_current_state(ws: web.WebSocketResponse) -> None:
    if LATEST_STATE is None:
        await ws.send_json({"type": "state_absent"})
        return
    meta = CLIENT_META.get(ws, {})
    await ws.send_json({
        "type": "state",
        "state": _state_for_role(
            LATEST_STATE,
            str(meta.get("role") or ""),
            str(meta.get("student_token") or ""),
            str(meta.get("student_name") or ""),
        ),
    })


def _sketch_normalize(value: object) -> str:
    text = str(value or "").lower().strip()
    text = re.sub(r"^(a|an|the)\s+", "", text)
    text = re.sub(r"[^a-z0-9 ]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _sketch_auto_match(guess: object, word: object) -> bool:
    g = _sketch_normalize(guess)
    w = _sketch_normalize(word)
    return bool(g) and (g == w or g == w + "s" or g + "s" == w)


def _sketch_award_score(run: dict, name: str) -> None:
    cfg = run.get("sketchConfig") if isinstance(run.get("sketchConfig"), dict) else {}
    if not cfg.get("scoring"):
        return
    scores = run.setdefault("sketchScores", {"students": {}, "teams": {}})
    if not isinstance(scores, dict):
        scores = {"students": {}, "teams": {}}
        run["sketchScores"] = scores
    students = scores.setdefault("students", {})
    teams = scores.setdefault("teams", {})
    if not isinstance(students, dict):
        students = {}
        scores["students"] = students
    if not isinstance(teams, dict):
        teams = {}
        scores["teams"] = teams
    students[name] = max(0, int(students.get(name, 0) or 0)) + 1
    if str(cfg.get("mode") or "free") == "teams":
        assignments = cfg.get("teamAssignments") if isinstance(cfg.get("teamAssignments"), dict) else {}
        try:
            team = int(assignments.get(name, 0) or 0)
        except (TypeError, ValueError):
            team = 0
        if team > 0:
            key = str(team)
            teams[key] = max(0, int(teams.get(key, 0) or 0)) + 1


STARWHEEL_VALUES = (100, 200, 300, 400, 500, 750, 1000, 500)
STARWHEEL_SPECIALS = (
    ("power", "POWER SURGE"),
    ("shield", "SHIELD"),
    ("cargo", "CARGO"),
    ("wormhole", "WORMHOLE"),
    ("tax", "ALIEN TAX"),
)
STARWHEEL_VOWELS = {"A", "E", "I", "O", "U"}
STARWHEEL_CONSONANTS = set("BCDFGHJKLMNPQRSTVWXYZ")


def _starwheel_connected_students(state: dict) -> list[dict]:
    return [
        st for st in state.get("students", [])
        if isinstance(st, dict) and not st.get("offline") and str(st.get("n") or "")
    ]


def _starwheel_team_members(state: dict, run: dict, team_index: int) -> list[dict]:
    cfg = run.get("starwheelConfig") if isinstance(run.get("starwheelConfig"), dict) else {}
    assignments = cfg.get("teamAssignments") if isinstance(cfg.get("teamAssignments"), dict) else {}
    team_number = int(team_index) + 1
    return [st for st in _starwheel_connected_students(state) if int(assignments.get(str(st.get("n")), 0) or 0) == team_number]


def _starwheel_active_pilot_name(state: dict, run: dict) -> str:
    cfg = run.get("starwheelConfig") if isinstance(run.get("starwheelConfig"), dict) else {}
    sw = run.get("starwheel") if isinstance(run.get("starwheel"), dict) else {}
    students = _starwheel_connected_students(state)
    if not students:
        return ""
    if str(cfg.get("mode") or "teams") != "teams":
        try:
            idx = int(sw.get("freePilotIndex", 0) or 0) % len(students)
        except (TypeError, ValueError):
            idx = 0
        return str(students[idx].get("n") or "")

    try:
        count = max(2, min(4, int(cfg.get("teamCount", 2) or 2)))
        active = int(sw.get("activeTeam", 0) or 0) % count
    except (TypeError, ValueError):
        count, active = 2, 0
    members = _starwheel_team_members(state, run, active)
    if not members:
        for step in range(1, count + 1):
            candidate = (active + step) % count
            candidate_members = _starwheel_team_members(state, run, candidate)
            if candidate_members:
                active, members = candidate, candidate_members
                sw["activeTeam"] = active
                break
    if not members:
        return ""
    indexes = sw.setdefault("pilotIndexes", {})
    try:
        idx = int(indexes.get(str(active), 0) or 0) % len(members)
    except (TypeError, ValueError):
        idx = 0
    return str(members[idx].get("n") or "")


def _starwheel_score_bucket(run: dict, name: str) -> tuple[dict, str]:
    cfg = run.get("starwheelConfig") if isinstance(run.get("starwheelConfig"), dict) else {}
    sw = run.setdefault("starwheel", {})
    scores = sw.setdefault("scores", {"students": {}, "teams": {}})
    students = scores.setdefault("students", {})
    teams = scores.setdefault("teams", {})
    if str(cfg.get("mode") or "teams") == "teams":
        try:
            team = int(sw.get("activeTeam", 0) or 0)
        except (TypeError, ValueError):
            team = 0
        return teams, str(team)
    return students, name


def _starwheel_adjust_score(run: dict, name: str, delta: int) -> int:
    cfg = run.get("starwheelConfig") if isinstance(run.get("starwheelConfig"), dict) else {}
    if not cfg.get("scoring"):
        return 0
    bucket, key = _starwheel_score_bucket(run, name)
    try:
        current = int(bucket.get(key, 0) or 0)
    except (TypeError, ValueError):
        current = 0
    bucket[key] = max(0, current + int(delta))
    return int(bucket[key])


def _starwheel_status_key(run: dict, name: str) -> str:
    cfg = run.get("starwheelConfig") if isinstance(run.get("starwheelConfig"), dict) else {}
    sw = run.get("starwheel") if isinstance(run.get("starwheel"), dict) else {}
    if str(cfg.get("mode") or "teams") == "teams":
        try:
            return str(int(sw.get("activeTeam", 0) or 0))
        except (TypeError, ValueError):
            return "0"
    return str(name or "")


def _starwheel_special_state(run: dict, field: str) -> dict:
    sw = run.setdefault("starwheel", {})
    mapping = sw.setdefault(field, {})
    if not isinstance(mapping, dict):
        mapping = {}
        sw[field] = mapping
    return mapping


def _starwheel_apply_special(state: dict, run: dict, name: str, kind: str, label: str) -> None:
    sw = run.get("starwheel") if isinstance(run.get("starwheel"), dict) else {}
    cfg = run.get("starwheelConfig") if isinstance(run.get("starwheelConfig"), dict) else {}
    key = _starwheel_status_key(run, name)
    power = _starwheel_special_state(run, "powerSurge")
    shields = _starwheel_special_state(run, "shields")
    sw["spinValue"] = None
    sw["spinLabel"] = label
    sw["lastSpecial"] = kind
    sw["stage"] = "ready"

    if kind == "power":
        power[key] = True
        sw["message"] = "POWER SURGE armed — the next correct consonant is worth ×2."
        return
    if kind == "shield":
        shields[key] = 1
        sw["message"] = "SHIELD online — the next Wormhole or Alien Tax is blocked."
        return
    if kind == "cargo":
        if cfg.get("scoring"):
            total = _starwheel_adjust_score(run, name, 500)
            sw["message"] = f"CARGO recovered — +500 Energy. Total: {total}."
        else:
            sw["message"] = "CARGO recovered — crew keeps control."
        return
    if kind in {"wormhole", "tax"}:
        try:
            shield_count = int(shields.get(key, 0) or 0)
        except (TypeError, ValueError):
            shield_count = 0
        if shield_count > 0:
            shields[key] = max(0, shield_count - 1)
            sw["message"] = f"SHIELD absorbed the {label}. Control stays here."
            return
        if kind == "wormhole":
            _starwheel_advance(state, run, False)
            sw["message"] = "WORMHOLE opened — control jumps to the next crew."
            return
        if cfg.get("scoring"):
            total = _starwheel_adjust_score(run, name, -250)
            sw["message"] = f"ALIEN TAX — 250 Energy removed. Total: {total}."
        else:
            sw["message"] = "ALIEN TAX detected — no score is active, so no Energy was lost."


def _starwheel_advance(state: dict, run: dict, keep_team: bool) -> None:
    cfg = run.get("starwheelConfig") if isinstance(run.get("starwheelConfig"), dict) else {}
    sw = run.get("starwheel") if isinstance(run.get("starwheel"), dict) else {}
    students = _starwheel_connected_students(state)
    if not students:
        return
    if str(cfg.get("mode") or "teams") != "teams":
        try:
            sw["freePilotIndex"] = (int(sw.get("freePilotIndex", 0) or 0) + 1) % len(students)
        except (TypeError, ValueError):
            sw["freePilotIndex"] = 0
        return
    try:
        count = max(2, min(4, int(cfg.get("teamCount", 2) or 2)))
        team = int(sw.get("activeTeam", 0) or 0) % count
    except (TypeError, ValueError):
        count, team = 2, 0
    members = _starwheel_team_members(state, run, team)
    indexes = sw.setdefault("pilotIndexes", {})
    if members:
        try:
            indexes[str(team)] = (int(indexes.get(str(team), 0) or 0) + 1) % len(members)
        except (TypeError, ValueError):
            indexes[str(team)] = 0
    if not keep_team:
        for step in range(1, count + 1):
            candidate = (team + step) % count
            if _starwheel_team_members(state, run, candidate):
                sw["activeTeam"] = candidate
                break


def _starwheel_apply_request(state: dict, run: dict, name: str, request: dict) -> None:
    sw = run.get("starwheel") if isinstance(run.get("starwheel"), dict) else None
    cfg = run.get("starwheelConfig") if isinstance(run.get("starwheelConfig"), dict) else {}
    if not isinstance(sw, dict) or sw.get("solved"):
        return
    request_id = str(request.get("id") or "")[:120]
    if not request_id or request_id == str(sw.get("lastRequestId") or ""):
        return
    if str(request.get("name") or name) != name:
        return
    if _starwheel_active_pilot_name(state, run) != name:
        return
    sw["lastRequestId"] = request_id
    action = str(request.get("type") or "")
    value = str(request.get("value") or "").strip().upper()
    answer = str(cfg.get("answer") or "").upper()
    used = [str(x).upper() for x in sw.get("usedLetters", []) if str(x)]
    revealed = [str(x).upper() for x in sw.get("revealed", []) if str(x)]
    sw["usedLetters"] = used
    sw["revealed"] = revealed

    if action == "spin":
        if str(sw.get("stage") or "ready") != "ready" or sw.get("pendingSolve"):
            return
        if cfg.get("specialSectors"):
            sectors = [("number", value) for value in STARWHEEL_VALUES[:7]] + list(STARWHEEL_SPECIALS)
        else:
            sectors = [("number", value) for value in STARWHEEL_VALUES]
        index = secrets.randbelow(len(sectors))
        kind, payload = sectors[index]
        sw["spinIndex"] = index
        sw["spinNonce"] = int(sw.get("spinNonce", 0) or 0) + 1
        step = 360.0 / len(sectors)
        target = (360.0 - (index * step + step / 2.0)) % 360.0
        current_deg = float(sw.get("spinDeg", 0) or 0)
        sw["spinFromDeg"] = current_deg
        current_mod = current_deg % 360.0
        delta = (target - current_mod) % 360.0
        sw["spinDeg"] = current_deg + 720.0 + delta
        if kind == "number":
            spin_value = int(payload)
            sw["spinValue"] = spin_value
            sw["spinLabel"] = str(spin_value)
            sw["lastSpecial"] = ""
            sw["stage"] = "letter"
            sw["message"] = f"{name} spun {spin_value}. Choose a consonant."
        else:
            _starwheel_apply_special(state, run, name, str(kind), str(payload))
        return

    if action == "letter":
        if str(sw.get("stage") or "") != "letter" or value not in STARWHEEL_CONSONANTS or value in used:
            return
        used.append(value)
        occurrences = answer.count(value)
        if occurrences > 0 and value not in revealed:
            revealed.append(value)
        base_points = int(sw.get("spinValue", 0) or 0) * occurrences
        key = _starwheel_status_key(run, name)
        power = _starwheel_special_state(run, "powerSurge")
        multiplier = 1
        if occurrences > 0 and power.get(key):
            multiplier *= 2
            power[key] = False
        if occurrences > 0 and cfg.get("finalSignal"):
            multiplier *= 2
        points = base_points * multiplier
        if occurrences > 0 and cfg.get("scoring"):
            _starwheel_adjust_score(run, name, points)
        _starwheel_advance(state, run, occurrences > 0)
        sw["stage"] = "ready"
        sw["spinValue"] = None
        sw["spinLabel"] = ""
        boost = f" ×{multiplier}" if occurrences > 0 and multiplier > 1 else ""
        sw["message"] = (
            f"{value} appears {occurrences} time{'s' if occurrences != 1 else ''}. "
            + (f"{points} points{boost}. Crew keeps control." if occurrences > 0 and cfg.get("scoring")
               else f"Signal boost{boost}. Crew keeps control." if occurrences > 0
               else "No signal match. Control passes.")
        )
        return

    if action == "vowel":
        if str(sw.get("stage") or "ready") != "ready" or value not in STARWHEEL_VOWELS or value in used:
            return
        if cfg.get("scoring"):
            bucket, key = _starwheel_score_bucket(run, name)
            try:
                current_score = int(bucket.get(key, 0) or 0)
            except (TypeError, ValueError):
                current_score = 0
            if current_score < 250:
                sw["message"] = "Not enough Energy to buy a vowel."
                return
            bucket[key] = current_score - 250
        used.append(value)
        occurrences = answer.count(value)
        if occurrences > 0 and value not in revealed:
            revealed.append(value)
        _starwheel_advance(state, run, occurrences > 0)
        sw["stage"] = "ready"
        sw["spinLabel"] = ""
        sw["message"] = (
            f"Vowel {value} restored in {occurrences} position{'s' if occurrences != 1 else ''}. "
            + ("Crew keeps control." if occurrences > 0 else "No signal match. Control passes.")
        )
        return

    if action == "solve":
        if str(sw.get("stage") or "ready") not in {"ready", "letter"} or sw.get("pendingSolve"):
            return
        text = str(request.get("value") or "").strip()[:80]
        if not text:
            return
        try:
            team = int(sw.get("activeTeam", 0) or 0) if str(cfg.get("mode") or "teams") == "teams" else -1
        except (TypeError, ValueError):
            team = -1
        sw["pendingSolve"] = {"name": name, "text": text, "team": team, "at": request.get("at")}
        sw["solvePendingBy"] = name
        sw["stage"] = "solve_pending"
        sw["message"] = f"{name} submitted a Solve Signal. Mission Control is reviewing it."


def _minefield_current_navigator(state: dict, run: dict) -> Optional[str]:
    students = [st for st in state.get("students", []) if isinstance(st, dict) and not st.get("offline")]
    if not students:
        return None
    mode = str(run.get("minefieldMode") or state.get("minefieldMode") or "crew")
    if mode == "teacher":
        if run.get("activeSide", "class") != "class":
            return None
        mf = run.get("mfClass") or {}
        idx = int(mf.get("navigatorIndex", 0) or 0) % len(students)
        return str(students[idx].get("n", ""))
    if mode == "teams":
        count = max(2, min(3, int(run.get("minefieldTeamCount") or state.get("minefieldTeamCount") or 2)))
        active = int(run.get("activeTeam", 0) or 0) % count
        team = [st for i, st in enumerate(students) if i % count == active]
        if not team:
            return None
        mfs = run.get("mfTeams") or []
        mf = mfs[active] if active < len(mfs) and isinstance(mfs[active], dict) else {}
        idx = int(mf.get("navigatorIndex", 0) or 0) % len(team)
        return str(team[idx].get("n", ""))
    mf = run.get("mf") or {}
    idx = int(mf.get("navigatorIndex", 0) or 0) % len(students)
    return str(students[idx].get("n", ""))


def merge_student_snapshot(canonical: Optional[dict], incoming: dict, token: str = "", name: str = "") -> dict:
    """Merge only the sending student's classroom actions into canonical state.

    This prevents simultaneous student responses from replacing one another when the
    legacy UI sends whole-state snapshots. Teacher snapshots remain authoritative.
    """
    if not isinstance(canonical, dict):
        canonical = copy.deepcopy(incoming)
    out = copy.deepcopy(canonical)
    if out.get("ended"):
        return out
    inc_student = _student_by_identity(incoming, token, name)
    if inc_student is None:
        return out
    token = str(inc_student.get("studentToken", token or ""))
    name = str(inc_student.get("n", name or ""))
    if not name:
        return out

    # Once a student name/token exists in canonical state, another socket cannot
    # claim that identity with a different token or rename an existing token.
    existing_by_name = _student_by_identity(out, "", name)
    if existing_by_name is not None:
        existing_token = str(existing_by_name.get("studentToken") or "")
        if existing_token and existing_token != token:
            return out
    if token:
        existing_by_token = _student_by_identity(out, token, "")
        if existing_by_token is not None and str(existing_by_token.get("n") or "") != name:
            return out

    can_student = _student_by_identity(out, token, name)
    if can_student is None:
        clean = {k: copy.deepcopy(v) for k, v in inc_student.items() if k in {"n", "c", "avatarKey", "studentToken", "readyResponse", "emotion", "understanding"}}
        out.setdefault("students", []).append(clean)
        can_student = clean
    else:
        active_prompt = bool(out.get("promptActive"))
        screen = str(out.get("screen") or "")
        allowed_prompt_fields = {
            "readyResponse": active_prompt and screen == "ready",
            "emotion": active_prompt and screen == "emotion",
            "understanding": active_prompt and screen == "understanding",
        }
        for k, allowed in allowed_prompt_fields.items():
            if allowed and k in inc_student:
                can_student[k] = copy.deepcopy(inc_student[k])

    # Student-owned membership in classroom queues. Teacher enable/disable state wins
    # over delayed student snapshots so closed controls cannot re-open themselves.
    for field, enabled_field in (("buzz", "buzzEnabled"), ("help", "helpEnabled")):
        inc_list = incoming.get(field, []) if isinstance(incoming.get(field), list) else []
        cur = [x for x in out.get(field, []) if x != name]
        if out.get(enabled_field) and name in inc_list:
            cur.append(name)
        out[field] = cur

    inc_alerts = incoming.get("alerts", []) if isinstance(incoming.get("alerts"), list) else []
    cur_alerts = [a for a in out.get("alerts", []) if not (isinstance(a, dict) and a.get("type") == "hand" and a.get("name") == name)]
    if out.get("handEnabled") and any(isinstance(a, dict) and a.get("type") == "hand" and a.get("name") == name for a in inc_alerts):
        cur_alerts.append({"type": "hand", "name": name})
    out["alerts"] = cur_alerts

    # Students may add their own private help messages while Ask for Help is enabled.
    # Teacher-deleted message IDs remain authoritative so stale student snapshots cannot restore them.
    inc_help_messages = incoming.get("helpMessages", []) if isinstance(incoming.get("helpMessages"), list) else []
    cur_help_messages = out.get("helpMessages", []) if isinstance(out.get("helpMessages"), list) else []
    deleted_help_ids = {str(x) for x in (out.get("helpDeletedIds", []) if isinstance(out.get("helpDeletedIds"), list) else [])}
    if out.get("helpEnabled"):
        known_help_ids = {str(m.get("id")) for m in cur_help_messages if isinstance(m, dict)}
        for msg in inc_help_messages:
            if not isinstance(msg, dict) or msg.get("name") != name:
                continue
            mid = str(msg.get("id") or "")
            if not mid or mid in deleted_help_ids or mid in known_help_ids:
                continue
            clean_msg = {
                "id": mid[:120],
                "name": name,
                "text": str(msg.get("text") or "I need help")[:240],
                "at": msg.get("at"),
                "seen": False,
            }
            cur_help_messages.insert(0, clean_msg)
            known_help_ids.add(mid)
    out["helpMessages"] = cur_help_messages

    # Students may send a photo whenever the teacher has Picture enabled.
    # A separate picture prompt is optional; teacher deletion/disable remains authoritative.
    inc_photos = incoming.get("photos", []) if isinstance(incoming.get("photos"), list) else []
    cur_photos = out.get("photos", []) if isinstance(out.get("photos"), list) else []
    if out.get("pictureEnabled"):
        known_ids = {str(p.get("id")) for p in cur_photos if isinstance(p, dict)}
        for photo in inc_photos:
            if isinstance(photo, dict) and photo.get("name") == name and str(photo.get("id")) not in known_ids:
                clean_photo = {
                    "id": photo.get("id"),
                    "name": name,
                    "data": str(photo.get("data") or "")[:2500000],
                    "seen": False,
                }
                if clean_photo["data"].startswith("data:image/"):
                    cur_photos.insert(0, clean_photo)
                    known_ids.add(str(clean_photo["id"]))
    out["photos"] = cur_photos

    can_run = out.get("activityRun")
    inc_run = incoming.get("activityRun")
    if not isinstance(can_run, dict) or not isinstance(inc_run, dict) or can_run.get("activityId") != inc_run.get("activityId"):
        return out
    if str(can_run.get("phase") or "") != "running":
        return out

    # Activity generation tokens invalidate delayed packets after resets, lobby
    # pauses, board authority changes, new Sketch rounds, and ORBIT follow-ups.
    can_token = str(can_run.get("runToken") or "")
    inc_token = str(inc_run.get("runToken") or "")
    if can_token and inc_token != can_token:
        return out

    aid = str(can_run.get("activityId", ""))

    # SI+ / generic response maps: accept only the teacher's current slide.
    # This prevents a delayed answer from landing after the class has moved on.
    inc_responses = inc_run.get("responses") if isinstance(inc_run.get("responses"), dict) else {}
    can_responses = can_run.setdefault("responses", {})
    current_slide = str(can_run.get("slideIndex", 0) or 0)
    response_map = inc_responses.get(current_slide)
    if isinstance(response_map, dict) and name in response_map:
        can_responses.setdefault(current_slide, {})[name] = copy.deepcopy(response_map[name])

    if aid == "starwheel-game":
        request = inc_run.get("starwheelRequest")
        if isinstance(request, dict):
            _starwheel_apply_request(out, can_run, name, request)

    elif aid == "vector-game":
        vr = inc_run.get("vectorResponses") or {}
        if isinstance(vr, dict) and isinstance(vr.get(name), dict):
            can_map = can_run.setdefault("vectorResponses", {})
            current = can_map.get(name) if isinstance(can_map.get(name), dict) else {}
            # Once a Vector is locked, stale packets cannot unlock or alter it.
            if not current.get("locked"):
                raw = vr[name]
                clean_pins = []
                for pin in raw.get("pins", []) if isinstance(raw.get("pins"), list) else []:
                    if not isinstance(pin, dict):
                        continue
                    try:
                        x = max(0.0, min(100.0, float(pin.get("x", 0))))
                        y = max(0.0, min(100.0, float(pin.get("y", 0))))
                    except (TypeError, ValueError):
                        continue
                    clean_pins.append({"x": round(x, 2), "y": round(y, 2)})
                    if len(clean_pins) >= 8:
                        break
                cfg = can_run.get("vectorConfig") if isinstance(can_run.get("vectorConfig"), dict) else {}
                if str(cfg.get("mode") or "single") == "multi":
                    try:
                        need = max(2, min(8, int(cfg.get("pinCount", 3) or 3)))
                    except (TypeError, ValueError):
                        need = 3
                else:
                    need = 1
                can_map[name] = {"pins": clean_pins, "locked": bool(raw.get("locked")) and len(clean_pins) >= need}

    elif aid == "orbit-game":
        rr = inc_run.get("orbitResponses") or {}
        can_round = int(can_run.get("orbitRound", 1) or 1)
        try:
            inc_round = int(inc_run.get("orbitRound", 1) or 1)
        except (TypeError, ValueError):
            inc_round = -1
        can_map = can_run.setdefault("orbitResponses", {})
        if inc_round == can_round and name not in can_map and isinstance(rr, dict) and isinstance(rr.get(name), dict):
            text_value = str(rr[name].get("text") or "").strip()[:500]
            if text_value:
                can_map[name] = {"text": text_value, "at": rr[name].get("at")}

    elif aid == "pixel-game":
        pg = inc_run.get("pixelGuesses") or {}
        if isinstance(pg, dict) and isinstance(pg.get(name), dict):
            can_map = can_run.setdefault("pixelGuesses", {})
            current = can_map.get(name) if isinstance(can_map.get(name), dict) else None
            allow_updates = bool((can_run.get("pixelConfig") or {}).get("allowUpdates"))
            incoming_guess = pg[name]
            try:
                incoming_at = float(incoming_guess.get("at") or 0)
            except (TypeError, ValueError):
                incoming_at = 0
            try:
                current_at = float(current.get("at") or 0) if current else -1
            except (TypeError, ValueError):
                current_at = -1
            if current is None or (allow_updates and incoming_at >= current_at):
                clean = {
                    "guess": str(incoming_guess.get("guess") or "")[:120],
                    "at": incoming_guess.get("at"),
                    "remainingAtSubmit": incoming_guess.get("remainingAtSubmit"),
                    "firstCorrectRemaining": incoming_guess.get("firstCorrectRemaining"),
                }
                # Teacher scoring is authoritative across student updates.
                if current and "teacherCorrect" in current:
                    clean["teacherCorrect"] = current.get("teacherCorrect")
                elif "teacherCorrect" in incoming_guess:
                    clean["teacherCorrect"] = incoming_guess.get("teacherCorrect")
                if current and current.get("firstCorrectRemaining") is not None and clean.get("firstCorrectRemaining") is None:
                    clean["firstCorrectRemaining"] = current.get("firstCorrectRemaining")
                can_map[name] = clean

    elif aid == "board-game":
        can_board = can_run.get("board") or {}
        inc_board = inc_run.get("board") or {}
        if can_board.get("controller") == name and isinstance(can_board.get("pages"), list) and isinstance(inc_board.get("pages"), list):
            inc_pages = {str(pg.get("id")): pg for pg in inc_board.get("pages", []) if isinstance(pg, dict)}
            for page in can_board.get("pages", []):
                if not isinstance(page, dict):
                    continue
                other = inc_pages.get(str(page.get("id")))
                if not other:
                    continue
                kept = [st for st in page.get("strokes", []) if not (isinstance(st, dict) and st.get("owner") == name)]
                own = [copy.deepcopy(st) for st in other.get("strokes", []) if isinstance(st, dict) and st.get("owner") == name]
                page["strokes"] = kept + own

    elif aid == "sketch-game":
        can_sketch = can_run.get("sketch") or {}
        inc_sketch = inc_run.get("sketch") or {}
        try:
            can_round = int(can_sketch.get("round", 0) or 0)
            inc_round = int(inc_sketch.get("round", 0) or 0) if isinstance(inc_sketch, dict) else -1
        except (TypeError, ValueError):
            can_round, inc_round = -1, -2
        same_round = (
            isinstance(inc_sketch, dict)
            and can_round == inc_round
            and str(can_sketch.get("artist") or "") == str(inc_sketch.get("artist") or "")
            and str(can_sketch.get("word") or "") == str(inc_sketch.get("word") or "")
        )
        if same_round:
            inc_guesses = inc_sketch.get("guesses") or {}
            if isinstance(inc_guesses, dict) and isinstance(inc_guesses.get(name), dict):
                can_guesses = can_sketch.setdefault("guesses", {})
                raw_guess = inc_guesses[name]
                guess_text = str(raw_guess.get("text") or "")[:80]
                auto_accepted = _sketch_auto_match(guess_text, can_sketch.get("word"))
                incoming_guess = {
                    "text": guess_text,
                    "status": "accepted" if auto_accepted else "pending",
                    "at": raw_guess.get("at"),
                }
                current = can_guesses.get(name) if isinstance(can_guesses.get(name), dict) else None
                accept_guess = current is None
                current_status = str(current.get("status") or "") if current else ""
                if current:
                    try:
                        incoming_at = float(incoming_guess.get("at") or 0)
                        current_at = float(current.get("at") or 0)
                        reviewed_at = float(current.get("reviewedAt") or 0)
                    except (TypeError, ValueError):
                        incoming_at, current_at, reviewed_at = 0, 0, 0
                    if current_status == "accepted":
                        accept_guess = False
                    elif current_status == "rejected":
                        # A rejected guess may be replaced only by a genuinely new guess.
                        accept_guess = incoming_at > max(current_at, reviewed_at)
                    else:
                        accept_guess = incoming_at >= current_at
                if accept_guess:
                    if incoming_guess["status"] == "accepted":
                        _sketch_award_score(can_run, name)
                        incoming_guess["scored"] = bool((can_run.get("sketchConfig") or {}).get("scoring"))
                    can_guesses[name] = incoming_guess
                    can_run["sketch"] = can_sketch

            can_board = can_run.get("board") or {}
            inc_board = inc_run.get("board") or {}
            if can_sketch.get("artist") == name and can_board.get("controller") == name and isinstance(can_board.get("pages"), list) and isinstance(inc_board.get("pages"), list):
                inc_pages = {str(pg.get("id")): pg for pg in inc_board.get("pages", []) if isinstance(pg, dict)}
                for page in can_board.get("pages", []):
                    if not isinstance(page, dict):
                        continue
                    other = inc_pages.get(str(page.get("id")))
                    if not other:
                        continue
                    kept = [st for st in page.get("strokes", []) if not (isinstance(st, dict) and st.get("owner") == name)]
                    own = [copy.deepcopy(st) for st in other.get("strokes", []) if isinstance(st, dict) and st.get("owner") == name]
                    page["strokes"] = kept + own

    elif aid == "minefield-game":
        # Navigator packets may alter only the active Minefield field and the
        # turn-transition fields it legitimately controls. Teacher configuration,
        # inactive team fields, and unrelated activity state remain authoritative.
        if _minefield_current_navigator(out, can_run) == name:
            mode = str(can_run.get("minefieldMode") or out.get("minefieldMode") or "crew")
            def valid_field_transition(current_field: object, incoming_field: object) -> bool:
                if not isinstance(current_field, dict) or not isinstance(incoming_field, dict):
                    return False
                try:
                    current_turn = int(current_field.get("turn", 1) or 1)
                    incoming_turn = int(incoming_field.get("turn", 1) or 1)
                except (TypeError, ValueError):
                    return False
                return incoming_turn in (current_turn, current_turn + 1)

            if mode == "teams":
                try:
                    active_idx = int(can_run.get("activeTeam", 0) or 0)
                except (TypeError, ValueError):
                    active_idx = 0
                can_fields = can_run.get("mfTeams")
                inc_fields = inc_run.get("mfTeams")
                if isinstance(can_fields, list) and isinstance(inc_fields, list) and 0 <= active_idx < len(can_fields) and active_idx < len(inc_fields) and valid_field_transition(can_fields[active_idx], inc_fields[active_idx]):
                    can_fields[active_idx] = copy.deepcopy(inc_fields[active_idx])
                    winner = inc_run.get("teamWinner")
                    if winner is None or winner == active_idx:
                        can_run["teamWinner"] = winner
                    try:
                        next_idx = int(inc_run.get("activeTeam", active_idx))
                    except (TypeError, ValueError):
                        next_idx = active_idx
                    if 0 <= next_idx < len(can_fields):
                        can_run["activeTeam"] = next_idx
            elif mode == "teacher":
                if str(can_run.get("activeSide") or "class") == "class" and valid_field_transition(can_run.get("mfClass"), inc_run.get("mfClass")):
                    can_run["mfClass"] = copy.deepcopy(inc_run["mfClass"])
                    next_side = str(inc_run.get("activeSide") or "class")
                    if next_side in ("class", "teacher"):
                        can_run["activeSide"] = next_side
                    winner = inc_run.get("teacherVsWinner")
                    if winner is None or winner in ("class", "teacher"):
                        can_run["teacherVsWinner"] = winner
            else:
                if valid_field_transition(can_run.get("mf"), inc_run.get("mf")):
                    can_run["mf"] = copy.deepcopy(inc_run["mf"])
            if isinstance(inc_run.get("narrationLog"), list):
                can_run["narrationLog"] = copy.deepcopy(inc_run["narrationLog"][-6:])
            can_run["latestNarration"] = str(inc_run.get("latestNarration") or can_run.get("latestNarration") or "")[:1200]

    return out


def load_teacher_storage() -> dict[str, str]:
    with db() as con:
        rows = con.execute("SELECT key,value FROM teacher_kv").fetchall()
    return {r["key"]: r["value"] for r in rows if r["key"] in PERSISTED_STORAGE_KEYS}


def save_teacher_storage(key: str, value: str) -> None:
    if key not in PERSISTED_STORAGE_KEYS:
        raise ValueError("unsupported storage key")
    with db() as con:
        con.execute(
            """INSERT INTO teacher_kv(key,value,updated_at) VALUES(?,?,?)
               ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at""",
            (key, value, time.time()),
        )


def get_or_create_auth_secret() -> str:
    with db() as con:
        row = con.execute("SELECT value FROM server_meta WHERE key='auth_secret'").fetchone()
        if row:
            return str(row["value"])
        value = secrets.token_urlsafe(48)
        con.execute("INSERT INTO server_meta(key,value) VALUES('auth_secret',?)", (value,))
        return value


def teacher_cookie_value() -> str:
    secret = get_or_create_auth_secret().encode("utf-8")
    return hmac.new(secret, b"si-mothership-teacher", hashlib.sha256).hexdigest()


def teacher_authorized(request: web.Request, data: Optional[dict] = None) -> bool:
    cookie = request.cookies.get("si_teacher_session", "")
    if cookie and hmac.compare_digest(cookie, teacher_cookie_value()):
        return True
    # Backward-compatible local API access while moving clients to cookie auth.
    if isinstance(data, dict) and str(data.get("teacher_key", "")) == TEACHER_KEY:
        return True
    return False


def set_teacher_cookie(response: web.StreamResponse, remember: bool, secure: bool) -> None:
    kwargs = {
        "httponly": True,
        "samesite": "Lax",
        "secure": secure,
        "path": "/",
    }
    if remember:
        kwargs["max_age"] = 60 * 60 * 24 * 30
    response.set_cookie("si_teacher_session", teacher_cookie_value(), **kwargs)


def get_lan_ip() -> str:
    candidates: list[str] = []
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET, socket.SOCK_STREAM):
            ip = info[4][0]
            if ip and not ip.startswith("127.") and not ip.startswith("169.254."):
                candidates.append(ip)
    except Exception:
        pass
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.2)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith("127.") and not ip.startswith("169.254."):
            candidates.insert(0, ip)
    except Exception:
        pass
    seen = set()
    for ip in candidates:
        if ip not in seen:
            seen.add(ip)
            return ip
    return "127.0.0.1"


LAN_IP = get_lan_ip()
LOCAL_ORIGIN = f"http://{LAN_IP}:{PORT}"
PUBLIC_ORIGIN = PUBLIC_BASE_URL or LOCAL_ORIGIN


def effective_origin(request: web.Request) -> str:
    if PUBLIC_BASE_URL:
        return PUBLIC_BASE_URL
    forwarded_proto = (request.headers.get("X-Forwarded-Proto") or "").split(",", 1)[0].strip()
    forwarded_host = (request.headers.get("X-Forwarded-Host") or "").split(",", 1)[0].strip()
    proto = forwarded_proto or request.scheme
    host = forwarded_host or (request.host or "").strip()
    hostname = host.split(":", 1)[0].strip("[]").lower() if host else ""
    if host and hostname not in {"localhost", "127.0.0.1", "::1"}:
        return f"{proto}://{host}"
    return LOCAL_ORIGIN

def make_qr_data_uri(target: str) -> str:
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=2)
    qr.add_data(target)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def session_urls(origin: str) -> dict:
    student_url = origin + f"/?role=student&code={CURRENT_JOIN_CODE}&sid={CURRENT_SESSION_ID}"
    shared_url = origin + f"/?role=shared&sid={CURRENT_SESSION_ID}"
    return {
        "code": CURRENT_JOIN_CODE,
        "session_id": CURRENT_SESSION_ID,
        "student_url": student_url,
        "shared_url": shared_url,
        "qr_data": make_qr_data_uri(student_url),
    }


async def index(request: web.Request) -> web.Response:
    text = INDEX_PATH.read_text(encoding="utf-8")
    origin = effective_origin(request)
    urls = session_urls(origin)
    role = (request.query.get("role") or "teacher").lower()
    authenticated = role == "teacher" and teacher_authorized(request)
    all_store = load_teacher_storage()
    if authenticated:
        store = all_store
    elif role == "student":
        store = {k: v for k, v in all_store.items() if k in PUBLIC_STORAGE_KEYS}
    else:
        store = {}
    # Hydrate only the storage appropriate for this role before the app script runs.
    storage_boot = (
        "(function(){"
        f"const d={json.dumps(store)};"
        "try{Object.keys(d).forEach(k=>localStorage.setItem(k,d[k]));}catch(e){}"
        "const persistKeys=new Set(Object.keys(d).concat(["
        + ",".join(json.dumps(k) for k in sorted(PERSISTED_STORAGE_KEYS))
        + "]));"
        "const role=new URLSearchParams(location.search).get('role')||'teacher';"
        "const orig=Storage.prototype.setItem;"
        "Storage.prototype.setItem=function(k,v){orig.call(this,k,v);"
        "if(this===localStorage&&role==='teacher'&&persistKeys.has(k)){"
        "fetch('/api/storage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k,value:String(v)})}).catch(()=>{});"
        "}};"
        "if(role==='teacher'){persistKeys.forEach(k=>{if(!(k in d)){const v=localStorage.getItem(k);if(v!==null)fetch('/api/storage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k,value:v})}).catch(()=>{});}});}"
        "})();"
    )
    injected = (
        "<script>"
        f"window.__SI_PUBLIC_ORIGIN__={json.dumps(origin)};"
        f"window.__SI_JOIN_CODE__={json.dumps(CURRENT_JOIN_CODE)};"
        f"window.__SI_SESSION_ID__={json.dumps(CURRENT_SESSION_ID)};"
        f"window.__SI_STUDENT_URL__={json.dumps(urls['student_url'])};"
        f"window.__SI_SHARED_URL__={json.dumps(urls['shared_url'])};"
        f"window.__SI_QR_DATA_URI__={json.dumps(urls['qr_data'])};"
        f"window.__SI_TEACHER_AUTHENTICATED__={json.dumps(authenticated)};"
        f"window.__SI_SERVER_AUTH_AVAILABLE__=true;"
        + storage_boot
        + "</script>"
    )
    text = text.replace("<head>", "<head>" + injected, 1)
    return web.Response(text=text, content_type="text/html", headers={"Cache-Control": "no-store, no-cache, must-revalidate"})


async def health(request: web.Request) -> web.Response:
    role_counts = {"teacher": 0, "student": 0, "shared": 0, "other": 0}
    for ws in list(CLIENTS):
        if ws.closed:
            continue
        role = str(CLIENT_META.get(ws, {}).get("role") or "other")
        role_counts[role if role in role_counts else "other"] += 1
    return web.json_response({
        "ok": True,
        "version": APP_VERSION,
        "join_code": CURRENT_JOIN_CODE,
        "session_id": CURRENT_SESSION_ID,
        "public_origin": effective_origin(request),
        "clients": len(CLIENTS),
        "client_roles": role_counts,
        "state_persisted": LATEST_STATE is not None,
        "database": DB_PATH.name,
    }, headers={"Cache-Control": "no-store"})


async def info(request: web.Request) -> web.Response:
    origin = effective_origin(request)
    urls = session_urls(origin)
    return web.json_response({
        "ok": True,
        "join_code": CURRENT_JOIN_CODE,
        "session_id": CURRENT_SESSION_ID,
        "teacher_url": origin + "/",
        "student_url": urls["student_url"],
        "shared_url": urls["shared_url"],
    })


async def join_check(request: web.Request) -> web.Response:
    code = (request.query.get("code") or "").strip().upper()
    sid = (request.query.get("sid") or "").strip()
    ok = code == CURRENT_JOIN_CODE and (not sid or sid == CURRENT_SESSION_ID)
    return web.json_response({"ok": ok, "code": CURRENT_JOIN_CODE if ok else None, "session_id": CURRENT_SESSION_ID if ok else None}, headers={"Cache-Control": "no-store"})


async def session_info(request: web.Request) -> web.Response:
    return web.json_response({"ok": True, **session_urls(effective_origin(request))}, headers={"Cache-Control": "no-store"})


async def qr_png(request: web.Request) -> web.Response:
    target = (request.query.get("url") or "").strip()
    if not target:
        target = session_urls(effective_origin(request))["student_url"]
    try:
        parts = urlsplit(target)
        if parts.scheme not in {"http", "https"}:
            raise ValueError("unsupported QR URL")
    except Exception:
        raise web.HTTPBadRequest(text="Invalid QR URL")
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=2)
    qr.add_data(target)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return web.Response(body=buf.getvalue(), content_type="image/png", headers={"Cache-Control": "no-store"})


async def teacher_login(request: web.Request) -> web.Response:
    data = await request.json()
    if str(data.get("key", "")).strip() != TEACHER_KEY:
        return web.json_response({"ok": False, "error": "invalid_key"}, status=401)
    remember = bool(data.get("remember"))
    response = web.json_response({"ok": True})
    set_teacher_cookie(response, remember, effective_origin(request).startswith("https://"))
    return response


async def teacher_status(request: web.Request) -> web.Response:
    return web.json_response({"ok": True, "authenticated": teacher_authorized(request)})


async def teacher_logout(request: web.Request) -> web.Response:
    response = web.json_response({"ok": True})
    response.del_cookie("si_teacher_session", path="/")
    return response


async def storage_write(request: web.Request) -> web.Response:
    data = await request.json()
    if not teacher_authorized(request, data):
        raise web.HTTPUnauthorized(text="Teacher login required")
    key = str(data.get("key", ""))
    value = str(data.get("value", ""))
    if key not in PERSISTED_STORAGE_KEYS:
        raise web.HTTPBadRequest(text="Unsupported key")
    if len(value.encode("utf-8")) > 24 * 1024 * 1024:
        raise web.HTTPRequestEntityTooLarge(max_size=24 * 1024 * 1024, actual_size=len(value.encode("utf-8")))
    save_teacher_storage(key, value)
    return web.json_response({"ok": True, "key": key})


async def storage_snapshot(request: web.Request) -> web.Response:
    items = load_teacher_storage()
    if teacher_authorized(request):
        return web.json_response({"ok": True, "items": items, "scope": "teacher"})
    public_items = {k: v for k, v in items.items() if k in PUBLIC_STORAGE_KEYS}
    return web.json_response({"ok": True, "items": public_items, "scope": "public"})


async def new_session_handler(request: web.Request) -> web.Response:
    data = await request.json()
    if not teacher_authorized(request, data):
        raise web.HTTPUnauthorized(text="Teacher login required")
    code = rotate_session()
    # Student/shared clients from the prior session are disconnected. Teacher sockets remain.
    stale = []
    for ws in list(CLIENTS):
        meta = CLIENT_META.get(ws, {})
        if meta.get("role") in {"student", "shared"}:
            stale.append(ws)
    for ws in stale:
        try:
            await ws.send_json({"type": "session_reset"})
            await ws.close(code=4001, message=b"New classroom session")
        except Exception:
            pass
        CLIENTS.discard(ws)
        CLIENT_META.pop(ws, None)
    origin = effective_origin(request)
    urls = session_urls(origin)
    await broadcast({"type": "join_code", **urls})
    return web.json_response({"ok": True, **urls})


async def broadcast(payload: dict, exclude: Optional[web.WebSocketResponse] = None) -> None:
    dead = []
    for ws in list(CLIENTS):
        if ws is exclude or ws.closed:
            continue
        try:
            outgoing = payload
            if payload.get("type") == "state" and isinstance(payload.get("state"), dict):
                meta = CLIENT_META.get(ws, {})
                outgoing = dict(payload)
                outgoing["state"] = _state_for_role(
                    payload["state"],
                    str(meta.get("role") or ""),
                    str(meta.get("student_token") or ""),
                    str(meta.get("student_name") or ""),
                )
            await ws.send_str(json.dumps(outgoing, separators=(",", ":")))
        except Exception:
            dead.append(ws)
    for ws in dead:
        CLIENTS.discard(ws)
        CLIENT_META.pop(ws, None)


def student_connection_present(token: str = "", name: str = "") -> bool:
    """Return True when another live student socket represents this student.

    Refreshing a browser can briefly leave the old and new sockets alive at the
    same time. Presence should not flip offline when only the old socket closes.
    """
    token = str(token or "")
    name = str(name or "")
    for candidate in list(CLIENTS):
        if candidate.closed:
            continue
        meta = CLIENT_META.get(candidate, {})
        if meta.get("role") != "student":
            continue
        if token and str(meta.get("student_token") or "") == token:
            return True
        if name and str(meta.get("student_name") or "") == name:
            return True
    return False


async def websocket_handler(request: web.Request) -> web.WebSocketResponse:
    role = (request.query.get("role") or "client").lower()
    if role == "teacher" and not teacher_authorized(request):
        raise web.HTTPUnauthorized(text="Teacher login required")
    code = (request.query.get("code") or "").strip().upper()
    sid = (request.query.get("sid") or "").strip()
    if role == "student" and (code != CURRENT_JOIN_CODE or (sid and sid != CURRENT_SESSION_ID)):
        raise web.HTTPForbidden(text="Class code expired or invalid")
    if role == "shared" and sid and sid != CURRENT_SESSION_ID:
        raise web.HTTPForbidden(text="Shared-screen session expired")

    ws = web.WebSocketResponse(heartbeat=20, receive_timeout=None, max_msg_size=32 * 1024 * 1024)
    await ws.prepare(request)
    CLIENTS.add(ws)
    CLIENT_META[ws] = {"role": role, "code": code, "session_id": sid or CURRENT_SESSION_ID, "connected_at": time.time()}

    await _send_current_state(ws)
    await ws.send_json({"type": "join_code", **session_urls(effective_origin(request))})

    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                try:
                    data = json.loads(msg.data)
                except json.JSONDecodeError:
                    continue
                mtype = data.get("type")
                if mtype == "hello":
                    meta = CLIENT_META.get(ws, {})
                    if data.get("student_token") and not meta.get("student_token"):
                        meta["student_token"] = str(data.get("student_token"))
                    if data.get("student_name") and not meta.get("student_name"):
                        meta["student_name"] = str(data.get("student_name"))
                    CLIENT_META[ws] = meta
                    if role == "student" and meta.get("student_name"):
                        await broadcast({"type": "presence", "student_token": meta.get("student_token", ""), "student_name": meta.get("student_name", ""), "online": True}, exclude=ws)
                    await _send_current_state(ws)
                elif mtype == "starwheel_action" and isinstance(data.get("request"), dict):
                    request_data = copy.deepcopy(data["request"])
                    if role == "student":
                        meta = CLIENT_META.get(ws, {})
                        token = str(meta.get("student_token") or data.get("student_token") or "")
                        name = str(meta.get("student_name") or data.get("student_name") or "")
                        if token and not meta.get("student_token"):
                            meta["student_token"] = token
                        if name and not meta.get("student_name"):
                            meta["student_name"] = name
                        CLIENT_META[ws] = meta
                    elif role == "teacher":
                        name = str(data.get("student_name") or request_data.get("name") or "")
                    else:
                        continue
                    current = copy.deepcopy(LATEST_STATE) if isinstance(LATEST_STATE, dict) else None
                    run = current.get("activityRun") if isinstance(current, dict) else None
                    if isinstance(run, dict) and str(run.get("activityId") or "") == "starwheel-game" and str(run.get("phase") or "") == "running" and name:
                        request_data["name"] = name
                        _starwheel_apply_request(current, run, name, request_data)
                        save_runtime_state(current)
                        await broadcast({"type": "state", "state": LATEST_STATE}, exclude=None)
                elif mtype == "state" and isinstance(data.get("state"), dict):
                    if role == "teacher":
                        save_runtime_state(data["state"])
                    elif role == "student":
                        meta = CLIENT_META.get(ws, {})
                        # Lock the socket to its first established student identity.
                        # Later whole-state messages cannot switch to another student.
                        token = str(meta.get("student_token") or data.get("student_token") or "")
                        name = str(meta.get("student_name") or data.get("student_name") or "")
                        if token and not meta.get("student_token"):
                            meta["student_token"] = token
                        if name and not meta.get("student_name"):
                            meta["student_name"] = name
                        CLIENT_META[ws] = meta
                        merged = merge_student_snapshot(LATEST_STATE, data["state"], token, name)
                        save_runtime_state(merged)
                        if name:
                            await broadcast({"type": "presence", "student_token": token, "student_name": name, "online": True}, exclude=ws)
                    else:
                        # Shared-screen clients are view-only.
                        continue
                    await broadcast({"type": "state", "state": LATEST_STATE}, exclude=ws)
                    if role == "student":
                        await _send_current_state(ws)
                elif mtype == "session_reset" and role == "teacher":
                    save_runtime_state(None)
                    await broadcast({"type": "session_reset"}, exclude=ws)
            elif msg.type in (WSMsgType.ERROR, WSMsgType.CLOSE, WSMsgType.CLOSED):
                break
    finally:
        meta = CLIENT_META.get(ws, {})
        CLIENTS.discard(ws)
        CLIENT_META.pop(ws, None)
        if role == "student" and meta.get("student_name"):
            token = str(meta.get("student_token") or "")
            name = str(meta.get("student_name") or "")
            if not student_connection_present(token, name):
                try:
                    await broadcast({"type": "presence", "student_token": token, "student_name": name, "online": False})
                except Exception:
                    pass
    return ws


def create_app() -> web.Application:
    app = web.Application(client_max_size=32 * 1024 * 1024)
    app.router.add_get("/", index)
    app.router.add_get("/index.html", index)
    app.router.add_get("/api/health", health)
    app.router.add_get("/api/info", info)
    app.router.add_get("/api/join-check", join_check)
    app.router.add_get("/api/session/info", session_info)
    app.router.add_get("/api/qr", qr_png)
    app.router.add_post("/api/teacher/login", teacher_login)
    app.router.add_get("/api/teacher/status", teacher_status)
    app.router.add_post("/api/teacher/logout", teacher_logout)
    app.router.add_get("/api/storage", storage_snapshot)
    app.router.add_post("/api/storage", storage_write)
    app.router.add_post("/api/session/new", new_session_handler)
    app.router.add_get("/ws", websocket_handler)
    return app


async def open_browser_later() -> None:
    if NO_BROWSER or PUBLIC_BASE_URL or os.getenv("RENDER") or os.getenv("RAILWAY_ENVIRONMENT"):
        return
    await asyncio.sleep(1.0)
    try:
        webbrowser.open(LOCAL_ORIGIN + "/")
    except Exception:
        pass


async def main() -> None:
    init_db()
    app = create_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, HOST, PORT)
    await site.start()

    urls = session_urls(PUBLIC_ORIGIN)
    print("\n" + "=" * 72)
    print(f" SI MOTHERSHIP v{APP_VERSION} — VISUAL SYSTEM REFRESH")
    print("=" * 72)
    print(f" Teacher:       {PUBLIC_ORIGIN}/")
    print(f" Student:       {urls['student_url']}")
    print(f" 2nd Screen:    {urls['shared_url']}")
    print(f" Teacher key:   {TEACHER_KEY}")
    print(f" Student code:  {CURRENT_JOIN_CODE}")
    print(f" Data file:     {DB_PATH.name}")
    print("\nHosted-ready session server. Use PUBLIC_BASE_URL behind HTTPS if your host does not forward headers.")
    print("Starting a new session creates a fresh join code and clears old runtime state.")
    print("Keep this window open while using Mothership.")
    print("=" * 72 + "\n")
    sys.stdout.flush()

    asyncio.create_task(open_browser_later())
    stop = asyncio.Event()
    try:
        await stop.wait()
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    finally:
        await runner.cleanup()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
