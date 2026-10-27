"""Phase 4T: bounded, repeatable *real WebSocket* classroom stress tests.

Uses an isolated aiohttp TestServer, a temporary SQLite database and fabricated
student identities. Never connects to Railway or writes to production /data.
Covers concurrent browsers, teacher/projector views, retry storms, reconnection,
turn-taking, privacy and disk persistence without inventing results.
"""
import asyncio
import copy
import json
import tempfile
import unittest
from pathlib import Path

from aiohttp.test_utils import TestClient, TestServer
import server as app

STUDENTS = [
    {"n": f"Crew{i:02d}", "studentToken": f"phase4t-crew-token-{i:02d}",
     "c": "#40b8de", "offline": False}
    for i in range(18)
]
SUN = {"id": "sun", "text": "Sun"}
BINGO_TOKEN = "phase4t-bingo-running"
MATCH_TOKEN = "phase4t-match-running"
FOUR_TOKEN = "phase4t-four-running"


def fixture(game):
    root = {
        "screen": "activity", "ended": False, "students": copy.deepcopy(STUDENTS),
        "buzz": [], "helpMessages": [], "photos": [], "promptActive": False,
    }
    if game == "bingo":
        run = {
            "activityId": "bingo-game", "phase": "running", "runToken": BINGO_TOKEN,
            "bingoConfig": {"items": [SUN], "size": 4, "pattern": "line"},
            "bingo": {
                "cards": {s["n"]: ["sun"] for s in STUDENTS},
                "called": ["sun"], "marks": {s["n"]: [] for s in STUDENTS},
                "claims": [], "claimResults": {}, "message": "",
            },
        }
    elif game == "match":
        run = {
            "activityId": "match-game", "phase": "running", "runToken": MATCH_TOKEN,
            "matchConfig": {"mode": "individual", "turnRule": "one_each", "scoring": "pairs",
                            "playerOrder": [s["n"] for s in STUDENTS]},
            "match": {
                "cards": [
                    {"id": "a1", "pairId": "one", "content": {"text": "Sun"}},
                    {"id": "a2", "pairId": "one", "content": {"text": "Sun"}},
                    {"id": "b1", "pairId": "two", "content": {"text": "Moon"}},
                    {"id": "b2", "pairId": "two", "content": {"text": "Moon"}},
                ],
                "selected": [], "matched": [], "attempts": 0, "scores": {},
                "teamScores": {}, "activeStudentIndex": 0, "activeTeam": 0,
                "locked": False, "teacherLocked": False, "pauseAfterReveal": True,
                "complete": False, "history": [], "pendingResolution": None,
                "message": "",
            },
        }
    else:
        run = {
            "activityId": "four-in-line-game", "phase": "running",
            "runToken": FOUR_TOKEN,
            "fourInLine": {
                "cols": 7, "rows": 6, "board": [0] * 42,
                "players": ["Blue", "Gold"], "turn": 0, "status": "playing",
                "winner": None, "winning": [], "moves": 0, "history": [],
                "seats": {"Crew00": 0, "Crew01": 1}, "message": "Blue starts",
            },
        }
    root["activityRun"] = run
    return root


class Phase4TStress(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="si-phase4t-")
        self.before = (app.DB_PATH, app.LATEST_STATE,
                       app.CURRENT_SESSION_ID, app.CURRENT_JOIN_CODE)
        app.DB_PATH = Path(self.tmp.name) / "classroom.sqlite3"
        app.CLIENTS.clear()
        app.CLIENT_META.clear()
        app.init_db()
        app.save_runtime_state(fixture("bingo"))
        self.client = TestClient(TestServer(app.create_app()))
        await self.client.start_server()
        response = await self.client.post(
            "/api/teacher/login", json={"key": app.TEACHER_KEY})
        self.assertEqual(response.status, 200)
        self.sockets = []

    async def asyncTearDown(self):
        for socket in self.sockets:
            if not socket.closed:
                await socket.close()
        await self.client.close()
        app.CLIENTS.clear()
        app.CLIENT_META.clear()
        (app.DB_PATH, app.LATEST_STATE,
         app.CURRENT_SESSION_ID, app.CURRENT_JOIN_CODE) = self.before
        self.tmp.cleanup()

    async def open(self, role="student", student=None):
        params = {"role": role, "sid": app.CURRENT_SESSION_ID}
        if role == "student":
            params["code"] = app.CURRENT_JOIN_CODE
        socket = await self.client.ws_connect("/ws", params=params)
        self.sockets.append(socket)
        if student is not None:
            await socket.send_json({
                "type": "hello", "student_name": student["n"],
                "student_token": student["studentToken"]})
        return socket

    async def wait(self, check, subject, timeout=12):
        async def loop():
            while not check():
                await asyncio.sleep(.02)
        try:
            await asyncio.wait_for(loop(), timeout)
        except asyncio.TimeoutError:
            self.fail(f"Timed out waiting for {subject}")

    def game(self, key):
        return app.LATEST_STATE["activityRun"][key]

    def saved_game(self, key):
        with app.db() as db:
            data = json.loads(db.execute(
                "SELECT state_json FROM runtime WHERE id=1").fetchone()[0])
        return data["activityRun"][key]

    async def send(self, socket, channel, request_id, action, value,
                   run_token, student=None):
        request = {"id": request_id, "type": action, "value": value,
                   "runToken": run_token}
        if channel == "four_in_line_action":
            # Four In Line's real wire contract sends a numeric column field.
            request["column"] = value
        await socket.send_json({
            "type": channel,
            "student_name": student["n"] if student else "",
            "student_token": student["studentToken"] if student else "",
            "request": request,
        })

    async def latest_view(self, socket, predicate, label):
        """Drain older broadcasts and capture the *real* projected WS state."""
        async def read():
            while True:
                payload = await socket.receive_json(timeout=8)
                if payload.get("type") == "state" and predicate(payload["state"]):
                    return payload["state"]
        try:
            return await asyncio.wait_for(read(), 15)
        except asyncio.TimeoutError:
            self.fail("Did not receive final " + label)

    async def test_eighteen_student_bingo_burst_replays_and_projector(self):
        teacher = await self.open("teacher")
        shared = await self.open("shared")
        clients = await asyncio.gather(*[
            self.open(student=student) for student in STUDENTS])
        # Each browser sends the same request multiple times (network retries).
        # One physical tap with one request ID must never toggle a mark twice.
        await asyncio.gather(*[
            self.send(socket, "bingo_action", f"mark-{i}", "mark", "sun",
                      BINGO_TOKEN, STUDENTS[i])
            for i, socket in enumerate(clients) for _ in range(3)
        ])
        await self.wait(
            lambda: sum(self.game("bingo")["marks"][s["n"]] == ["sun"]
                        for s in STUDENTS) == len(STUDENTS),
            "all 18 independent Bingo marks")
        marks = self.game("bingo")["marks"]
        self.assertEqual(len(marks), 18)
        self.assertTrue(all(marks[s["n"]] == ["sun"] for s in STUDENTS))
        self.assertEqual(self.saved_game("bingo")["marks"], marks)

        teacher_state = await self.latest_view(
            teacher,
            lambda s: sum(bool(v) for v in
                          s["activityRun"]["bingo"]["marks"].values()) == 18,
            "teacher scoreboard")
        # Bingo marks/cards/claims are private to teacher and each student.
        # The shared screen must NOT see classroom-wide private marks.
        # Reconnect a projector to request the final, sanitized snapshot.
        fresh_shared = await self.open("shared")
        shared_state = await self.latest_view(
            fresh_shared,
            lambda s: s["activityRun"]["bingo"]["called"] == ["sun"],
            "privacy-filtered shared screen")
        self.assertEqual(
            shared_state["activityRun"]["bingo"]["marks"], {})
        self.assertEqual(
            shared_state["activityRun"]["bingo"]["cards"], {})
        self.assertEqual(
            teacher_state["activityRun"]["bingo"]["marks"], marks)
        self.assertTrue(all("studentToken" not in st
                            for st in shared_state["students"]))
        # Each student's state exposes only their own marks and token.
        one_view = await self.latest_view(
            clients[0],
            lambda s: s["activityRun"]["bingo"]["marks"].get("Crew00") == ["sun"],
            "student latest state")
        self.assertEqual(
            one_view["activityRun"]["bingo"]["marks"], {"Crew00": ["sun"]})
        self.assertEqual(
            [st.get("studentToken") for st in one_view["students"]
             if st.get("studentToken")], [STUDENTS[0]["studentToken"]])
        before = copy.deepcopy(self.game("bingo")["marks"])
        refreshed = await self.open(student=STUDENTS[0])
        await clients[0].close()
        await self.wait(
            lambda: app.LATEST_STATE["students"][0]["offline"] is False,
            "refreshed student stays online")
        await self.send(refreshed, "bingo_action", "mark-0",
                        "mark", "sun", BINGO_TOKEN, STUDENTS[0])
        await asyncio.sleep(.12)
        self.assertEqual(self.game("bingo")["marks"], before,
                         "reconnect replay cannot toggle a saved mark")
        await self.send(refreshed, "bingo_action", "fresh-toggle",
                        "mark", "sun", BINGO_TOKEN, STUDENTS[0])
        await self.wait(
            lambda: self.game("bingo")["marks"]["Crew00"] == [],
            "intentional second tap")
        self.assertEqual(
            self.saved_game("bingo")["marks"]["Crew00"], [])

        # Rapid double-claim messages with *different* IDs still produce one
        # pending teacher review, not duplicate winners or inflated history.
        await asyncio.gather(*[
            self.send(refreshed, "bingo_action", f"claim-{i}",
                      "claim", "", BINGO_TOKEN, STUDENTS[0])
            for i in range(8)
        ])
        await self.wait(
            lambda: len(self.game("bingo")["claims"]) == 1,
            "one Bingo claim pending")
        await asyncio.sleep(.08)
        self.assertEqual(len(self.saved_game("bingo")["claims"]), 1)
        self.assertEqual(len(self.game("bingo")["claims"]), 1)

    async def test_match_score_exactly_once_under_crew_and_retry_storm(self):
        app.save_runtime_state(fixture("match"))
        teacher = await self.open("teacher")
        shared = await self.open("shared")
        clients = await asyncio.gather(*[
            self.open(student=student) for student in STUDENTS])
        # 17 spectators all click while Crew00 is the active player.
        # Their actions must not steal the turn or reveal an extra card.
        await asyncio.gather(*[
            self.send(clients[i], "match_action", f"spectator-{i}", "select",
                      "b1", MATCH_TOKEN, STUDENTS[i])
            for i in range(1, len(clients))
        ])
        await self.wait(lambda: len(app.CLIENTS) >= 20, "classroom connected")
        await asyncio.sleep(.08)
        self.assertEqual(self.game("match")["selected"], [])
        await asyncio.gather(*[
            self.send(clients[0], "match_action", "tap-first", "select",
                      "a1", MATCH_TOKEN, STUDENTS[0])
            for _ in range(5)
        ])
        await self.wait(
            lambda: self.game("match")["selected"] == ["a1"],
            "first tap deduplicated")
        await asyncio.gather(*[
            self.send(clients[0], "match_action", "tap-second", "select",
                      "a2", MATCH_TOKEN, STUDENTS[0])
            for _ in range(5)
        ])
        await self.wait(lambda: self.game("match")["scores"].get("Crew00") == 1,
                        "one server-authoritative pair score")
        match = self.game("match")
        self.assertEqual(match["attempts"], 1)
        self.assertEqual(match["matched"], ["a1", "a2"])
        self.assertEqual(match["scores"], {"Crew00": 1})
        self.assertEqual(self.saved_game("match")["scores"], {"Crew00": 1})

        await asyncio.gather(*[
            self.send(teacher, "match_action", "continue-once",
                      "continue", "", MATCH_TOKEN)
            for _ in range(6)
        ])
        await self.wait(
            lambda: self.game("match")["activeStudentIndex"] == 1,
            "teacher Continue advances once")
        await asyncio.sleep(.08)
        self.assertEqual(self.game("match")["activeStudentIndex"], 1)
        self.assertEqual(self.saved_game("match")["activeStudentIndex"], 1)
        projected = await self.latest_view(
            shared,
            lambda s: s["activityRun"]["match"]["activeStudentIndex"] == 1,
            "MATCH shared turn")
        self.assertEqual(projected["activityRun"]["match"]["scores"]["Crew00"], 1)
        self.assertTrue(all("studentToken" not in s
                            for s in projected["students"]))

        # The next player reloads while older same-run packets are still around.
        # A previous run's request must not re-open their turn or mutate points.
        replacement = await self.open(student=STUDENTS[1])
        await clients[1].close()
        await self.send(replacement, "match_action", "stale-second",
                        "select", "b1", "obsolete-match-run", STUDENTS[1])
        await asyncio.sleep(.08)
        self.assertEqual(self.game("match")["selected"], [])
        self.assertEqual(self.game("match")["scores"], {"Crew00": 1})

    async def test_four_in_line_ordered_game_survives_spectator_pressure(self):
        app.save_runtime_state(fixture("four"))
        shared = await self.open("shared")
        clients = await asyncio.gather(*[
            self.open(student=student) for student in STUDENTS])
        # A legitimate seven-move game with 16 other students pressing
        # different columns in the background. Only assigned seats play.
        for move, column in enumerate((0, 0, 1, 1, 2, 2, 3)):
            player = move % 2
            await asyncio.gather(
                *[self.send(
                    clients[i], "four_in_line_action", f"noise-{move}-{i}",
                    "drop", 6, FOUR_TOKEN, STUDENTS[i])
                  for i in range(2, len(STUDENTS))],
                *[self.send(
                    clients[player], "four_in_line_action", f"move-{move}",
                    "drop", column, FOUR_TOKEN, STUDENTS[player])
                  for _ in range(3)],
            )
            await self.wait(
                lambda: self.game("fourInLine")["moves"] == move + 1,
                f"legal drop {move + 1}")
            self.assertEqual(self.game("fourInLine")["moves"], move + 1)
        board = self.game("fourInLine")
        self.assertEqual(board["status"], "won")
        self.assertEqual(board["winner"], 0)
        self.assertEqual(board["winning"], [35, 36, 37, 38])
        self.assertEqual(len(board["history"]), 7)
        self.assertEqual(board["board"][35:39], [1, 1, 1, 1])
        self.assertEqual(self.saved_game("fourInLine")["board"], board["board"])
        projection = await self.latest_view(
            shared,
            lambda s: s["activityRun"]["fourInLine"]["moves"] == 7,
            "Four In Line final shared board")
        self.assertEqual(projection["activityRun"]["fourInLine"]["winner"], 0)
        self.assertTrue(all("studentToken" not in st
                            for st in projection["students"]))
        # In a completed game even assigned players and a stale run must fail.
        await self.send(clients[1], "four_in_line_action", "late-after-win",
                        "drop", 4, FOUR_TOKEN, STUDENTS[1])
        await self.send(clients[0], "four_in_line_action", "from-old-session",
                        "drop", 4, "previous-session", STUDENTS[0])
        await asyncio.sleep(.08)
        self.assertEqual(self.game("fourInLine")["moves"], 7)


if __name__ == "__main__":
    unittest.main()
