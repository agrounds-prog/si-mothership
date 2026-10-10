"""Mothership Quick Poll: session-scoped, SQLite-backed classroom voting.

No student identifiers are stored in anonymous vote records. Results are
aggregated on the server and the shared view never receives raw vote rows.
"""
import base64
import hashlib
import hmac
import json
import re
import secrets
import time
from aiohttp import web

IMAGE_RE = re.compile(r"^data:image/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$")
STYLES = {"cards", "bars", "donut", "showdown"}
MAX_POLL_BODY = 1250000


class QuickPollService:
    def __init__(self, db, session, state, is_teacher, join_code):
        self.db, self.session, self.state, self.is_teacher, self.join_code = db, session, state, is_teacher, join_code
        self.ensure_tables()

    def ensure_tables(self):
        with self.db() as con:
            con.execute("""CREATE TABLE IF NOT EXISTS quick_poll_live
                (id INTEGER PRIMARY KEY CHECK(id=1), session_id TEXT NOT NULL, data TEXT NOT NULL)""")
            con.execute("""CREATE TABLE IF NOT EXISTS quick_poll_vote
                (poll_id TEXT NOT NULL, voter_key TEXT NOT NULL, selection TEXT NOT NULL,
                 PRIMARY KEY(poll_id, voter_key))""")
            con.execute("""CREATE TABLE IF NOT EXISTS quick_poll_template
                (id TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL, created REAL NOT NULL)""")
            con.execute("""CREATE TABLE IF NOT EXISTS quick_poll_config
                (key TEXT PRIMARY KEY, value TEXT NOT NULL)""")
            if not con.execute("SELECT 1 FROM quick_poll_config WHERE key='secret'").fetchone():
                con.execute("INSERT INTO quick_poll_config(key,value) VALUES('secret',?)",
                            (secrets.token_hex(32),))

    def reset(self):
        # Called on New Session. Reusable templates remain untouched.
        with self.db() as con:
            con.execute("DELETE FROM quick_poll_live")
            con.execute("DELETE FROM quick_poll_vote")

    @staticmethod
    def _safe_choice(item, index):
        label = str(item.get("label", "") if isinstance(item, dict) else "")[:100].strip()
        if not label:
            raise web.HTTPBadRequest(text="Every choice needs a short label.")
        image = str(item.get("image", "") if isinstance(item, dict) else "")
        if image:
            if len(image) > 175000 or not IMAGE_RE.fullmatch(image):
                raise web.HTTPBadRequest(text="Choice images must be small PNG, JPEG, or WebP uploads.")
            try:
                binary = base64.b64decode(image.partition(",")[2], validate=True)
            except Exception:
                raise web.HTTPBadRequest(text="Invalid choice image.")
            if len(binary) > 135000:
                raise web.HTTPBadRequest(text="Choice image is too large.")
        return {"id": str(index), "label": label, "image": image}

    @classmethod
    def clean(cls, payload):
        if not isinstance(payload, dict):
            raise web.HTTPBadRequest(text="Invalid poll.")
        title = str(payload.get("question", "")).strip()[:240]
        if not title:
            raise web.HTTPBadRequest(text="Enter a poll question.")
        items = payload.get("choices")
        if not isinstance(items, list) or not 2 <= len(items) <= 6:
            raise web.HTTPBadRequest(text="Quick Poll needs 2 to 6 choices.")
        choices = [cls._safe_choice(item, i) for i, item in enumerate(items)]
        multiple = bool(payload.get("multiple"))
        try:
            limit = int(payload.get("limit", 2 if multiple else 1))
            duration = int(payload.get("duration", 0))
        except (TypeError, ValueError):
            raise web.HTTPBadRequest(text="Invalid poll settings.")
        if limit < 1 or limit > len(choices) or limit > 4:
            raise web.HTTPBadRequest(text="Invalid selection limit.")
        if not multiple:
            limit = 1
        if duration not in (0, 15, 30, 60, 120, 300):
            raise web.HTTPBadRequest(text="Choose a supported timer.")
        sensitive = bool(payload.get("sensitive"))
        mode = str(payload.get("identity", "anonymous"))
        if mode not in ("anonymous", "identified"):
            raise web.HTTPBadRequest(text="Invalid identity setting.")
        if sensitive:
            mode = "anonymous"
        style = str(payload.get("display", "cards"))
        if style not in STYLES:
            style = "cards"
        if style == "showdown" and len(choices) != 2:
            style = "cards"
        return {
            "question": title,
            "description": str(payload.get("description", "")).strip()[:350],
            "choices": choices, "multiple": multiple, "limit": limit,
            "duration": duration, "identity": mode, "sensitive": sensitive,
            "visibility": "reveal" if sensitive or payload.get("visibility") == "reveal" else "live",
            "allowChange": bool(payload.get("allowChange", True)),
            "display": style,
        }

    def _get(self, con):
        row = con.execute("SELECT session_id,data FROM quick_poll_live WHERE id=1").fetchone()
        if not row or row["session_id"] != self.session():
            return None
        poll = json.loads(row["data"])
        if poll.get("phase") == "open" and poll.get("endAt") and time.time() >= poll["endAt"]:
            poll["phase"] = "closed"
            self._save(con, poll)
        return poll

    def _save(self, con, poll):
        con.execute("INSERT INTO quick_poll_live(id,session_id,data) VALUES(1,?,?) "
                    "ON CONFLICT(id) DO UPDATE SET session_id=excluded.session_id,data=excluded.data",
                    (self.session(), json.dumps(poll, separators=(",", ":"))))

    def _key(self, con, poll_id, token):
        secret = con.execute("SELECT value FROM quick_poll_config WHERE key='secret'").fetchone()["value"]
        return hmac.new(bytes.fromhex(secret), (poll_id + ":" + token).encode(), hashlib.sha256).hexdigest()

    def _student(self, request, data=None):
        values = data if isinstance(data, dict) else request.query
        sid = str(values.get("sid", ""))
        code = str(values.get("code", "")).upper()
        token = str(values.get("token", ""))
        # Correct class session and a real, server-maintained roster identity.
        # Do not accept student-name-only fallbacks or caller-supplied votes.
        if not sid or sid != self.session() or code != self.join_code() or len(token) < 8:
            raise web.HTTPForbidden(text="Join the current class before voting.")
        state = self.state()
        if not isinstance(state, dict):
            raise web.HTTPForbidden(text="No active classroom.")
        for student in (state.get("students") or []):
            if isinstance(student, dict) and hmac.compare_digest(str(student.get("studentToken") or ""), token):
                # Existing join code is carried in the canonical student URL.
                # Session ID + roster token identifies a joined student.
                return student
        raise web.HTTPForbidden(text="Your student identity is no longer in this class.")

    def _role(self, request):
        role = str(request.query.get("role", ""))
        if role == "teacher":
            if not self.is_teacher(request):
                raise web.HTTPUnauthorized(text="Teacher login required.")
            return role, None
        if role == "student":
            return role, self._student(request)
        if role == "shared":
            if str(request.query.get("sid") or "") != self.session():
                raise web.HTTPForbidden(text="Invalid shared session.")
            return role, None
        raise web.HTTPForbidden(text="Invalid classroom role.")

    @staticmethod
    def _count(con, poll):
        rows = con.execute("SELECT voter_key,selection FROM quick_poll_vote WHERE poll_id=?",
                           (poll["id"],)).fetchall()
        counts = {c["id"]: 0 for c in poll["choices"]}
        for row in rows:
            for value in json.loads(row["selection"]):
                if value in counts:
                    counts[value] += 1
        return rows, counts

    def _public(self, con, poll, role, student=None):
        data = {k: v for k, v in poll.items() if k not in ("before",)}
        rows, counts = self._count(con, poll)
        data["voters"] = len(rows)
        data["eligible"] = len([st for st in (self.state() or {}).get("students", [])
                                if isinstance(st, dict) and st.get("studentToken")])
        data["serverTime"] = time.time()
        data["ownVote"] = None
        if student and role == "student":
            voter_key = self._key(con, poll["id"], str(student["studentToken"]))
            match = next((r for r in rows if r["voter_key"] == voter_key), None)
            data["ownVote"] = json.loads(match["selection"]) if match else None
        allowed = role == "teacher" or (
            (poll["visibility"] == "live" or poll["phase"] != "open")
            and (not poll["sensitive"] or data["voters"] >= 5))
        if allowed:
            data["counts"] = counts
            if poll.get("before") and role == "teacher" or (
                poll.get("before") and not poll["sensitive"] and poll["phase"] != "open"
            ):
                data["before"] = poll["before"]
        else:
            data["counts"] = None
            data["before"] = None
        if poll["sensitive"] and role != "teacher" and data["eligible"] < 5:
            data["voters"] = None
            data["eligible"] = None
        if role == "teacher" and poll["identity"] == "identified" and not poll["sensitive"]:
            # Only teacher gets the identity breakdown, never public/student roles.
            lookup = {}
            for st in (self.state() or {}).get("students", []):
                if isinstance(st, dict) and st.get("studentToken"):
                    lookup[self._key(con, poll["id"], str(st["studentToken"]))] = str(st.get("n") or "Student")
            data["identifiedVotes"] = [
                {"name": lookup[row["voter_key"]], "choices": json.loads(row["selection"])}
                for row in rows if row["voter_key"] in lookup
            ]
        return data

    async def state_route(self, request):
        role, student = self._role(request)
        with self.db() as con:
            poll = self._get(con)
            return web.json_response({"active": bool(poll),
                "poll": self._public(con, poll, role, student) if poll else None},
                headers={"Cache-Control": "no-store"})

    async def launch_route(self, request):
        data = await request.json()
        if not self.is_teacher(request, data):
            raise web.HTTPUnauthorized(text="Teacher login required.")
        clean = self.clean(data)
        clean.update({"id": secrets.token_urlsafe(12), "phase": "open",
                      "startAt": time.time(), "endAt": time.time() + clean["duration"] if clean["duration"] else None,
                      "round": 1, "before": None, "sharedVisible": False})
        with self.db() as con:
            con.execute("DELETE FROM quick_poll_vote")
            self._save(con, clean)
        return web.json_response({"ok": True, "id": clean["id"]})

    async def vote_route(self, request):
        data = await request.json()
        student = self._student(request, data)
        raw = data.get("choices")
        if not isinstance(raw, list):
            raise web.HTTPBadRequest(text="Select an answer.")
        with self.db() as con:
            # Serialize concurrent votes across different student devices.
            con.execute("BEGIN IMMEDIATE")
            poll = self._get(con)
            if not poll or poll["phase"] != "open" or data.get("pollId") != poll["id"]:
                raise web.HTTPConflict(text="This poll is no longer accepting votes.")
            selected = list(dict.fromkeys(str(x) for x in raw))
            if not selected or len(selected) > poll["limit"] or any(
                x not in {c["id"] for c in poll["choices"]} for x in selected
            ):
                raise web.HTTPBadRequest(text="Select an allowed number of choices.")
            key = self._key(con, poll["id"], str(student["studentToken"]))
            existing = con.execute("SELECT 1 FROM quick_poll_vote WHERE poll_id=? AND voter_key=?",
                                   (poll["id"], key)).fetchone()
            if existing and not poll["allowChange"]:
                raise web.HTTPConflict(text="Your vote was already received.")
            con.execute("INSERT INTO quick_poll_vote(poll_id,voter_key,selection) VALUES(?,?,?) "
                        "ON CONFLICT(poll_id,voter_key) DO UPDATE SET selection=excluded.selection",
                        (poll["id"], key, json.dumps(selected)))
        return web.json_response({"ok": True, "choices": selected})

    async def control_route(self, request):
        data = await request.json()
        if not self.is_teacher(request, data):
            raise web.HTTPUnauthorized(text="Teacher login required.")
        action = str(data.get("action", ""))
        with self.db() as con:
            con.execute("BEGIN IMMEDIATE")
            poll = self._get(con)
            if not poll:
                raise web.HTTPConflict(text="No Quick Poll is running.")
            if action == "dismiss":
                con.execute("DELETE FROM quick_poll_live")
                con.execute("DELETE FROM quick_poll_vote")
                return web.json_response({"ok": True})
            if action in ("close", "reveal"):
                poll["phase"] = "closed"
            elif action == "reopen":
                poll["phase"] = "open"
                poll["endAt"] = None
            elif action == "revote":
                _, tally = self._count(con, poll)
                poll["before"] = tally
                poll["round"] = int(poll.get("round", 1)) + 1
                poll["phase"] = "open"
                poll["endAt"] = None
                con.execute("DELETE FROM quick_poll_vote")
            elif action == "display":
                style = str(data.get("display", ""))
                if style not in STYLES or (style == "showdown" and len(poll["choices"]) != 2):
                    raise web.HTTPBadRequest(text="Unavailable result layout.")
                poll["display"] = style
            elif action == "share":
                if type(data.get("visible")) is not bool:
                    raise web.HTTPBadRequest(text="Shared Screen visibility must be true or false.")
                poll["sharedVisible"] = data["visible"]
            else:
                raise web.HTTPBadRequest(text="Invalid poll action.")
            self._save(con, poll)
        return web.json_response({"ok": True})

    async def templates_route(self, request):
        if not self.is_teacher(request):
            raise web.HTTPUnauthorized(text="Teacher login required.")
        with self.db() as con:
            rows = con.execute("SELECT id,name,data FROM quick_poll_template ORDER BY created DESC LIMIT 50").fetchall()
        return web.json_response({"templates": [
            {"id": row["id"], "name": row["name"], "poll": json.loads(row["data"])}
            for row in rows
        ]})

    async def save_template_route(self, request):
        data = await request.json()
        if not self.is_teacher(request, data):
            raise web.HTTPUnauthorized(text="Teacher login required.")
        name = str(data.get("name", "")).strip()[:80] or "Untitled Poll"
        clean = self.clean(data.get("poll"))
        identifier = secrets.token_urlsafe(10)
        with self.db() as con:
            con.execute("INSERT INTO quick_poll_template(id,name,data,created) VALUES(?,?,?,?)",
                        (identifier, name, json.dumps(clean), time.time()))
        return web.json_response({"ok": True, "id": identifier})

    async def delete_template_route(self, request):
        data = await request.json()
        if not self.is_teacher(request, data):
            raise web.HTTPUnauthorized(text="Teacher login required.")
        with self.db() as con:
            con.execute("DELETE FROM quick_poll_template WHERE id=?", (str(data.get("id", "")),))
        return web.json_response({"ok": True})

    def install(self, app):
        app.router.add_get("/quick-poll.js", self.serve_js)
        app.router.add_get("/quick-poll.css", self.serve_css)
        app.router.add_get("/dashboard-polish.js", self.serve_dashboard_js)
        app.router.add_get("/dashboard-polish.css", self.serve_dashboard_css)
        app.router.add_get("/api/quick-poll/state", self.state_route)
        app.router.add_post("/api/quick-poll/launch", self.launch_route)
        app.router.add_post("/api/quick-poll/vote", self.vote_route)
        app.router.add_post("/api/quick-poll/control", self.control_route)
        app.router.add_get("/api/quick-poll/templates", self.templates_route)
        app.router.add_post("/api/quick-poll/templates", self.save_template_route)
        app.router.add_post("/api/quick-poll/templates/delete", self.delete_template_route)

    @staticmethod
    async def serve_js(request):
        from pathlib import Path
        return web.FileResponse(Path(__file__).with_name("quick-poll.js"),
                                headers={"Cache-Control": "no-store"})

    @staticmethod
    async def serve_css(request):
        from pathlib import Path
        return web.FileResponse(Path(__file__).with_name("quick-poll.css"),
                                headers={"Cache-Control": "no-store"})

    @staticmethod
    async def serve_dashboard_js(request):
        from pathlib import Path
        return web.FileResponse(Path(__file__).with_name("dashboard-polish.js"),
                                headers={"Cache-Control": "no-store"})

    @staticmethod
    async def serve_dashboard_css(request):
        from pathlib import Path
        return web.FileResponse(Path(__file__).with_name("dashboard-polish.css"),
                                headers={"Cache-Control": "no-store"})
