"""MILLION real aiohttp websocket multiplayer test on temporary storage (never production)."""
import copy
import json
import tempfile
import unittest
from pathlib import Path

from aiohttp.test_utils import TestClient, TestServer
import server as app


def classroom():
    questions = [
        {"prompt": "Question " + str(i + 1), "choices": [
            {"key": k, "text": "Option " + k} for k in "ABCD"
        ], "correct": ["B", "D", "A", "C", "B"][i],
         "mothershipClue": "Hidden clue " + str(i + 1),
         "explanation": "Private teacher explanation"}
        for i in range(5)
    ]
    return {
        "screen": "activity", "selectedStudent": "Pilot",
        "students": [
            {"n": "Pilot", "studentToken": "token-pilot-112233", "offline": False},
            {"n": "Crew", "studentToken": "token-crew-445566", "offline": False},
        ],
        "activityRun": {
            "activityId": "million-game", "runToken": "unique-million-run",
            "phase": "running", "responses": {},
            "millionConfig": {"questions": questions,
                "gameName": "Test Classroom Game", "pilotMode": "rotate", "risk": "practice",
                "ladder": [100, 500, 8000, 125000, 1000000], "checkpoints": [3]},
            "million": {
                "questionIndex": 0, "pilot": "Pilot", "pilotIndex": 0,
                "ladderLevel": 0, "inventory": {"poll": 1, "reduce": 1, "clue": 1, "tryAgain": 1},
                "selectedAnswer": "", "lockedAnswer": "", "crewPredictions": {},
                "eliminated": [], "publicClue": "", "pollOpen": False,
                "pollVisible": False, "revealed": False,
                "result": "", "complete": False, "over": False, "message": "Ready",
            },
        }, "ended": False,
    }


class MillionWebSocketE2E(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.orig_db, self.orig_state = app.DB_PATH, app.LATEST_STATE
        self.orig_sid, self.orig_code = app.CURRENT_SESSION_ID, app.CURRENT_JOIN_CODE
        app.DB_PATH = Path(self.tmp.name) / "million_ws.sqlite3"
        app.CLIENTS.clear()
        app.CLIENT_META.clear()
        app.init_db()
        app.save_runtime_state(classroom())
        self.client = TestClient(TestServer(app.create_app()))
        await self.client.start_server()
        login = await self.client.post("/api/teacher/login", json={"key": app.TEACHER_KEY})
        self.assertEqual(login.status, 200)

    async def asyncTearDown(self):
        await self.client.close()
        app.CLIENTS.clear()
        app.CLIENT_META.clear()
        app.DB_PATH, app.LATEST_STATE = self.orig_db, self.orig_state
        app.CURRENT_SESSION_ID, app.CURRENT_JOIN_CODE = self.orig_sid, self.orig_code
        self.tmp.cleanup()

    async def join(self, role, name="", token=""):
        sid = app.CURRENT_SESSION_ID
        code = app.CURRENT_JOIN_CODE
        params = {"role": role, "sid": sid}
        if role == "student":
            params["code"] = code
        ws = await self.client.ws_connect("/ws", params=params)
        if role == "student":
            await ws.send_json({"type": "hello", "student_name": name, "student_token": token})
        return ws

    async def state_from(self, ws, predicate=lambda s: True):
        for _ in range(20):
            message = await ws.receive_json(timeout=5)
            if message.get("type") == "state" and isinstance(message.get("state"), dict):
                if predicate(message["state"]):
                    return message["state"]
        raise AssertionError("No synchronized state matched predicate")

    async def request(self, ws, name, token, action, value="", ident="one"):
        await ws.send_json({"type": "game_show_action",
                            "student_name": name, "student_token": token,
                            "request": {"id": ident, "name": name,
                                        "game": "million", "type": action, "value": value}})

    async def test_live_two_student_actions_reveal_privacy_and_reset(self):
        shared = await self.join("shared")
        pilot = await self.join("student", "Pilot", "token-pilot-112233")
        crew = await self.join("student", "Crew", "token-crew-445566")
        await self.state_from(pilot, lambda s: bool(s["activityRun"]["millionConfig"]["questions"][0]["prompt"]))
        await self.state_from(crew, lambda s: bool(s["activityRun"]["millionConfig"]["questions"][0]["prompt"]))
        projector = await self.state_from(shared)
        self.assertNotIn("correct", projector["activityRun"]["millionConfig"]["questions"][0])
        self.assertEqual(projector["activityRun"]["millionConfig"]["questions"][1]["prompt"], "")

        # Both viewers receive actual server broadcasts; only the pilot can lock.
        await self.request(crew, "Crew", "token-crew-445566", "predict", "C", "crew-predict")
        audience = await self.state_from(crew, lambda s: s["activityRun"]["million"]["crewPredictions"].get("Crew") == "C")
        self.assertEqual(audience["activityRun"]["million"]["crewPredictions"], {"Crew": "C"})
        # Exercise the actual student WebSocket 50/50 path. Both students and
        # the projector must get the same two eliminations from server state.
        await self.request(pilot, "Pilot", "token-pilot-112233", "lifeline", "reduce", "pilot-5050")
        pilot_half = await self.state_from(pilot, lambda st: len(st["activityRun"]["million"]["eliminated"]) == 2)
        self.assertEqual(set(pilot_half["activityRun"]["million"]["eliminated"]), {"A", "C"})
        self.assertEqual(pilot_half["activityRun"]["million"]["inventory"]["reduce"], 0)
        viewer_half = await self.state_from(shared, lambda st: len(st["activityRun"]["million"]["eliminated"]) == 2)
        self.assertEqual(set(viewer_half["activityRun"]["million"]["eliminated"]), {"A", "C"})
        self.assertNotIn("correct", viewer_half["activityRun"]["millionConfig"]["questions"][0])
        await self.request(crew, "Crew", "token-crew-445566", "lock", "", "crew-forged-lock")
        await self.state_from(crew)
        self.assertEqual(app.LATEST_STATE["activityRun"]["million"]["lockedAnswer"], "")

        await self.request(pilot, "Pilot", "token-pilot-112233", "select", "B", "pilot-select")
        await self.state_from(pilot, lambda s: s["activityRun"]["million"]["selectedAnswer"] == "B")
        await self.request(pilot, "Pilot", "token-pilot-112233", "lock", "", "pilot-lock")
        await self.state_from(pilot, lambda s: s["activityRun"]["million"]["lockedAnswer"] == "B")
        self.assertEqual(app.LATEST_STATE["activityRun"]["million"]["lockedAnswer"], "B")
        spectator = await self.state_from(shared, lambda s: s["activityRun"]["million"]["lockedAnswer"] == "B")
        self.assertNotIn("correct", spectator["activityRun"]["millionConfig"]["questions"][0])
        self.assertNotIn("explanation", spectator["activityRun"]["millionConfig"]["questions"][0])
        self.assertEqual(spectator["activityRun"]["million"]["crewPredictions"], {})

        # Teacher scoring/reveal updates the canonical run, and the answer is
        # revealed in publicCorrect only after adjudication.
        current = copy.deepcopy(app.LATEST_STATE)
        m = current["activityRun"]["million"]
        m["revealed"] = True
        m["publicCorrect"] = "B"
        m["result"] = "correct"
        m["ladderLevel"] = 1
        app.save_runtime_state(current)
        await app.broadcast({"type": "state", "state": current})
        revealed = await self.state_from(shared, lambda s: s["activityRun"]["million"].get("revealed"))
        self.assertEqual(revealed["activityRun"]["million"]["publicCorrect"], "B")
        self.assertNotIn("correct", revealed["activityRun"]["millionConfig"]["questions"][0])

        # A new session must NOT delete the teacher-only saved game library.
        key = "siMothership.millionGames.v1"
        payload = json.dumps([{"id": "saved-game", "data": {"name": "Retain This"}}])
        response = await self.client.post("/api/storage", json={"key": key, "value": payload})
        self.assertEqual(response.status, 200)
        result = await self.client.post("/api/session/new", json={})
        self.assertEqual(result.status, 200)
        snapshot = await self.client.get("/api/storage")
        self.assertEqual((await snapshot.json())["items"][key], payload)
        await shared.close()
        await pilot.close()
        await crew.close()


if __name__ == "__main__":
    unittest.main()
