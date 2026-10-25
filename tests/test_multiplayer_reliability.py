"""Phase 4Q: real WebSocket reconnection, replay, identity and persistence.

All tests use an isolated, temporary SQLite classroom, never production /data.
"""
import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from aiohttp.test_utils import TestClient, TestServer
import server as app

ADA = {"n": "Ada", "studentToken": "ada-classroom-token", "c": "#4adada", "offline": False}
BOB = {"n": "Bob", "studentToken": "bob-classroom-token", "c": "#bcaaff", "offline": False}


def classroom(game="match"):
    if game == "match":
        run = {
            "activityId": "match-game", "runToken": "phase4q-match-1", "phase": "running",
            "matchConfig": {"mode": "individual", "turnRule": "one_each", "scoring": "pairs"},
            "match": {
                "cards": [
                    {"id": "a1", "pairId": "one", "content": {"text": "SUN"}},
                    {"id": "a2", "pairId": "one", "content": {"text": "SUN"}},
                    {"id": "b1", "pairId": "two", "content": {"text": "MOON"}},
                    {"id": "b2", "pairId": "two", "content": {"text": "MOON"}},
                ],
                "selected": [], "matched": [], "attempts": 0, "scores": {}, "teamScores": {},
                "activeStudentIndex": 0, "activeTeam": 0, "locked": False,
                "teacherLocked": False, "pauseAfterReveal": True, "complete": False,
                "history": [], "pendingResolution": None, "message": "",
            },
        }
    elif game == "bingo":
        run = {
            "activityId": "bingo-game", "runToken": "phase4q-bingo-1", "phase": "running",
            "bingoConfig": {"items": [{"id": "sun", "text": "Sun"}]},
            "bingo": {
                "cards": {"Ada": ["sun"], "Bob": ["sun"]},
                "called": ["sun"], "marks": {"Ada": [], "Bob": []},
                "claims": [], "claimResults": {}, "message": "",
            },
        }
    else:
        run = {"activityId": game + "-game", "runToken": "phase4q-" + game,
               "phase": "running", "testCount": 0}
    return {"screen": "activity", "ended": False,
            "students": [dict(ADA), dict(BOB)], "activityRun": run,
            "buzz": [], "helpMessages": [], "photos": []}


class MultiplayerReliability(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.originals = (app.DB_PATH, app.LATEST_STATE,
                          app.CURRENT_SESSION_ID, app.CURRENT_JOIN_CODE)
        app.DB_PATH = Path(self.tmp.name) / "classroom-phase4q.sqlite3"
        app.CLIENTS.clear()
        app.CLIENT_META.clear()
        app.init_db()
        app.save_runtime_state(classroom())
        self.client = TestClient(TestServer(app.create_app()))
        await self.client.start_server()
        response = await self.client.post("/api/teacher/login",
                                          json={"key": app.TEACHER_KEY})
        self.assertEqual(response.status, 200)
        self.sockets = []

    async def asyncTearDown(self):
        for ws in self.sockets:
            if not ws.closed:
                await ws.close()
        await self.client.close()
        app.CLIENTS.clear()
        app.CLIENT_META.clear()
        (app.DB_PATH, app.LATEST_STATE,
         app.CURRENT_SESSION_ID, app.CURRENT_JOIN_CODE) = self.originals
        self.tmp.cleanup()

    async def join(self, role, name="", token=""):
        params = {"role": role, "sid": app.CURRENT_SESSION_ID}
        if role == "student":
            params["code"] = app.CURRENT_JOIN_CODE
        ws = await self.client.ws_connect("/ws", params=params)
        self.sockets.append(ws)
        if role == "student":
            await ws.send_json({"type": "hello", "student_name": name, "student_token": token})
        return ws

    async def until(self, predicate, hint):
        for _ in range(80):
            if predicate():
                return
            await asyncio.sleep(0.025)
        self.fail("Timed out waiting for " + hint)

    def game(self):
        return app.LATEST_STATE["activityRun"]

    def disk_run(self):
        with app.db() as connection:
            row = connection.execute("SELECT state_json FROM runtime WHERE id=1").fetchone()
        return json.loads(row["state_json"])["activityRun"]

    async def action(self, ws, kind, rid, action, value="", token="",
                     name="", run_token=None):
        request = {"id": rid, "type": action, "value": value}
        if run_token is not None:
            request["runToken"] = run_token
        await ws.send_json({"type": kind, "request": request,
                            "student_token": token, "student_name": name})

    async def test_match_authorized_actions_score_once_reconnect_and_resume(self):
        teacher = await self.join("teacher")
        shared = await self.join("shared")
        ada = await self.join("student", "Ada", ADA["studentToken"])
        impostor = await self.join("student", "Ada", BOB["studentToken"])
        await self.action(impostor, "match_action", "forged", "select", "a1")
        await asyncio.sleep(0.06)
        self.assertEqual(self.game()["match"]["selected"], [],
                         "A different student's token cannot select Ada's cards")
        await self.action(ada, "match_action", "pick-1", "select", "a1",
                          run_token=self.game()["runToken"])
        await self.until(lambda: self.game()["match"]["selected"] == ["a1"], "first card")
        await self.action(ada, "match_action", "pick-2", "select", "a2",
                          run_token=self.game()["runToken"])
        await self.until(lambda: self.game()["match"]["scores"].get("Ada") == 1,
                         "authoritative auto scoring")
        await self.action(ada, "match_action", "pick-2", "select", "a2",
                          run_token=self.game()["runToken"])
        await asyncio.sleep(0.06)
        self.assertEqual(self.game()["match"]["attempts"], 1)
        self.assertEqual(self.game()["match"]["scores"]["Ada"], 1)
        self.assertEqual(self.game()["match"]["matched"], ["a1", "a2"])
        await self.action(teacher, "match_action", "teacher-resolve", "continue",
                          run_token=self.game()["runToken"])
        await self.until(lambda: self.game()["match"]["activeStudentIndex"] == 1,
                         "next turn after pair")
        await self.action(teacher, "match_action", "teacher-resolve", "continue",
                          run_token=self.game()["runToken"])
        await asyncio.sleep(0.06)
        self.assertEqual(self.game()["match"]["activeStudentIndex"], 1,
                         "replayed Continue must not advance the same turn twice")
        self.assertEqual(self.disk_run()["match"]["scores"]["Ada"], 1)
        self.assertEqual(self.disk_run()["match"]["activeStudentIndex"], 1)

        # A late old-run packet must not change an entirely new MATCH round.
        app.save_runtime_state(classroom("match"))
        app.LATEST_STATE["activityRun"]["runToken"] = "new-match-run"
        app.save_runtime_state(app.LATEST_STATE)
        await self.action(ada, "match_action", "stale-packet", "select", "b1",
                          run_token="phase4q-match-1")
        await asyncio.sleep(0.06)
        self.assertEqual(self.game()["match"]["selected"], [])
        await shared.close()
        await teacher.close()

    async def test_bingo_marks_idempotent_across_reconnect_and_saved(self):
        app.save_runtime_state(classroom("bingo"))
        ada = await self.join("student", "Ada", ADA["studentToken"])
        req = ("bingo_action", "mark-2026", "mark", "sun")
        await self.action(ada, *req, run_token=self.game()["runToken"])
        await self.until(lambda: self.game()["bingo"]["marks"]["Ada"] == ["sun"], "first mark")
        await self.action(ada, *req, run_token=self.game()["runToken"])
        await asyncio.sleep(0.06)
        self.assertEqual(self.game()["bingo"]["marks"]["Ada"], ["sun"])
        replacement = await self.join("student", "Ada", ADA["studentToken"])
        await ada.close()
        await self.action(replacement, *req, run_token=self.game()["runToken"])
        await asyncio.sleep(0.06)
        self.assertEqual(self.game()["bingo"]["marks"]["Ada"], ["sun"],
                         "same ID after reload cannot silently unmark a card")
        self.assertEqual(self.disk_run()["bingo"]["marks"]["Ada"], ["sun"])
        await self.action(replacement, "bingo_action", "mark-new", "mark", "sun",
                          run_token=self.game()["runToken"])
        await self.until(lambda: self.game()["bingo"]["marks"]["Ada"] == [], "intentional unmark")

    async def test_refresh_overlap_and_offline_presence_are_durable(self):
        ada = await self.join("student", "Ada", ADA["studentToken"])
        await self.until(lambda: self.game() is not None and
                         not app.LATEST_STATE["students"][0].get("offline"), "online")
        refreshed = await self.join("student", "Ada", ADA["studentToken"])
        await ada.close()
        await asyncio.sleep(0.06)
        self.assertFalse(app.LATEST_STATE["students"][0].get("offline"),
                         "closing old tab must not mark the refreshed tab offline")
        await refreshed.close()
        await self.until(lambda: app.LATEST_STATE["students"][0].get("offline"),
                         "offline roster persisted")
        self.assertTrue(self.disk_run() is not None)
        with app.db() as c:
            saved = json.loads(c.execute("SELECT state_json FROM runtime WHERE id=1").fetchone()[0])
        self.assertTrue(saved["students"][0]["offline"])
        returned = await self.join("student", "Ada", ADA["studentToken"])
        await self.until(lambda: not app.LATEST_STATE["students"][0].get("offline"),
                         "rejoin restores online presence")
        self.assertFalse(app.LATEST_STATE["students"][0]["offline"])
        await returned.close()

    async def test_other_engines_deduplicate_accepted_moves(self):
        ada = await self.join("student", "Ada", ADA["studentToken"])
        channels = [
            ("four_in_line_action", "apply_four_in_line_action", "four"),
            ("dominoes_action", "apply_dominoes_action", "dominoes"),
            ("cosmic_action", "apply_cosmic_action", "cosmic"),
            ("signal_sequence_action", "apply_signal_sequence_action", "signal"),
        ]
        for mtype, implementation, game in channels:
            app.save_runtime_state(classroom(game))
            def accept(current, run, name, request):
                run["testCount"] = run.get("testCount", 0) + 1
                return True
            with self.subTest(game=game), patch.object(app, implementation, side_effect=accept):
                await self.action(ada, mtype, "repeat-" + game, "select", "test")
                await self.until(lambda: self.game().get("testCount") == 1, game + " action")
                await self.action(ada, mtype, "repeat-" + game, "select", "test")
                await asyncio.sleep(0.06)
                self.assertEqual(self.game()["testCount"], 1)
                self.assertEqual(self.disk_run()["testCount"], 1)


if __name__ == "__main__":
    unittest.main()
