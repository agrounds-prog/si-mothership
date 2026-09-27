from __future__ import annotations

import asyncio
import base64
import copy
import io
import json
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
APP_VERSION = "46.7"

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
    "siMothership.appShortcuts.v1",
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

    # Students may add their own photos only while the teacher's picture prompt is live.
    # Teacher deletion/closure remains authoritative over delayed uploads.
    inc_photos = incoming.get("photos", []) if isinstance(incoming.get("photos"), list) else []
    cur_photos = out.get("photos", []) if isinstance(out.get("photos"), list) else []
    if out.get("pictureEnabled") and out.get("picturePromptSent") and str(out.get("screen") or "") == "picture":
        known_ids = {str(p.get("id")) for p in cur_photos if isinstance(p, dict)}
        for photo in inc_photos:
            if isinstance(photo, dict) and photo.get("name") == name and str(photo.get("id")) not in known_ids:
                cur_photos.insert(0, copy.deepcopy(photo))
                known_ids.add(str(photo.get("id")))
    out["photos"] = cur_photos

    can_run = out.get("activityRun")
    inc_run = incoming.get("activityRun")
    if not isinstance(can_run, dict) or not isinstance(inc_run, dict) or can_run.get("activityId") != inc_run.get("activityId"):
        return out
    if str(can_run.get("phase") or "") != "running":
        return out

    aid = str(can_run.get("activityId", ""))
    # SI+ and generic answer maps.
    inc_responses = inc_run.get("responses") if isinstance(inc_run.get("responses"), dict) else {}
    can_responses = can_run.setdefault("responses", {})
    for slide_key, response_map in inc_responses.items():
        if isinstance(response_map, dict) and name in response_map:
            can_responses.setdefault(str(slide_key), {})[name] = copy.deepcopy(response_map[name])

    if aid == "vector-game":
        vr = inc_run.get("vectorResponses") or {}
        if isinstance(vr, dict) and name in vr:
            can_run.setdefault("vectorResponses", {})[name] = copy.deepcopy(vr[name])
    elif aid == "orbit-game":
        rr = inc_run.get("orbitResponses") or {}
        if isinstance(rr, dict) and name in rr:
            can_run.setdefault("orbitResponses", {})[name] = copy.deepcopy(rr[name])
    elif aid == "pixel-game":
        pg = inc_run.get("pixelGuesses") or {}
        if isinstance(pg, dict) and name in pg:
            can_run.setdefault("pixelGuesses", {})[name] = copy.deepcopy(pg[name])
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
    elif aid == "minefield-game":
        if _minefield_current_navigator(out, can_run) == name:
            # Minefield has one active Navigator, so its move can safely advance the game state.
            out["activityRun"] = copy.deepcopy(inc_run)

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
    data = json.dumps(payload, separators=(",", ":"))
    for ws in list(CLIENTS):
        if ws is exclude or ws.closed:
            continue
        try:
            await ws.send_str(data)
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

    if LATEST_STATE is not None:
        await ws.send_json({"type": "state", "state": LATEST_STATE})
    else:
        await ws.send_json({"type": "state_absent"})
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
                    if data.get("student_token"):
                        meta["student_token"] = str(data.get("student_token"))
                    if data.get("student_name"):
                        meta["student_name"] = str(data.get("student_name"))
                    CLIENT_META[ws] = meta
                    if role == "student" and meta.get("student_name"):
                        await broadcast({"type": "presence", "student_token": meta.get("student_token", ""), "student_name": meta.get("student_name", ""), "online": True}, exclude=ws)
                    if LATEST_STATE is not None:
                        await ws.send_json({"type": "state", "state": LATEST_STATE})
                    else:
                        await ws.send_json({"type": "state_absent"})
                elif mtype == "state" and isinstance(data.get("state"), dict):
                    if role == "teacher":
                        save_runtime_state(data["state"])
                    elif role == "student":
                        meta = CLIENT_META.get(ws, {})
                        token = str(data.get("student_token") or meta.get("student_token") or "")
                        name = str(data.get("student_name") or meta.get("student_name") or "")
                        if token:
                            meta["student_token"] = token
                        if name:
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
                        await ws.send_json({"type": "state", "state": LATEST_STATE})
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
    print(f" SI MOTHERSHIP v{APP_VERSION} — SI+ SHARED SCREEN")
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
