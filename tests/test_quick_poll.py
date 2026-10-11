"""Quick Poll integration/privacy regression. Uses isolated temporary SQLite only."""
import asyncio
import json
import tempfile
import time
import unittest
from pathlib import Path
from aiohttp.test_utils import TestClient, TestServer
import server as app


class QuickPollSmoke(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.original_db = app.DB_PATH
        self.original_state = app.LATEST_STATE
        app.DB_PATH = Path(self.tmp.name) / "poll_test.sqlite3"
        app.CLIENTS.clear()
        app.CLIENT_META.clear()
        app.init_db()
        app.save_runtime_state({
            "screen": "activity", "students": [
                {"n": "Alpha", "studentToken": "student-alpha-unique", "avatarKey": "robot"},
                {"n": "Beta", "studentToken": "student-beta-unique", "avatarKey": "pilot"},
                {"n": "Gamma", "studentToken": "student-gamma-unique", "avatarKey": "alien"}
            ],
            "activityRun": {"activityId": "match-game", "phase": "running", "match": {"attempts": 5}},
            "buzz": [], "alerts": [], "ended": False,
        })
        self.initial_activity = json.loads(json.dumps(app.LATEST_STATE["activityRun"]))
        self.client = TestClient(TestServer(app.create_app()))
        await self.client.start_server()
        login = await self.client.post("/api/teacher/login", json={"key": app.TEACHER_KEY, "remember": False})
        self.assertEqual(login.status, 200)

    async def asyncTearDown(self):
        await self.client.close()
        app.CLIENTS.clear()
        app.CLIENT_META.clear()
        app.DB_PATH = self.original_db
        app.LATEST_STATE = self.original_state
        self.tmp.cleanup()

    def student(self, token, code=None, sid=None):
        return {"sid": sid or app.CURRENT_SESSION_ID, "code": code or app.CURRENT_JOIN_CODE, "token": token}

    async def launch(self, **overrides):
        data = {"question": "Where should the crew go?", "choices": [
            {"label": "Moon", "image": ""}, {"label": "Mars", "image": ""},
            {"label": "Ocean", "image": ""}
        ], "identity": "anonymous", "visibility": "live", "allowChange": True, "duration": 0}
        data.update(overrides)
        res = await self.client.post("/api/quick-poll/launch", json=data)
        self.assertEqual(res.status, 200, await res.text())
        return (await res.json())["id"]

    async def get(self, role, identity=None):
        params = {"role": role}
        if role == "student":
            params.update(self.student(identity))
        if role == "shared":
            params["sid"] = app.CURRENT_SESSION_ID
        res = await self.client.get("/api/quick-poll/state", params=params)
        self.assertEqual(res.status, 200, await res.text())
        return (await res.json())["poll"]

    async def vote(self, poll_id, token, choices, **context):
        data = {**self.student(token), "pollId": poll_id, "choices": choices, **context}
        return await self.client.post("/api/quick-poll/vote", json=data)

    async def control(self, action, **kwargs):
        res = await self.client.post("/api/quick-poll/control", json={"action": action, **kwargs})
        self.assertEqual(res.status, 200, await res.text())

    async def test_quick_poll_loader_stays_outside_inline_html_strings(self):
        page = await self.client.get("/")
        self.assertEqual(page.status, 200)
        html = await page.text()
        loader = '<script src="/quick-poll.js?v=1" defer></script>'
        self.assertEqual(html.count(loader), 1)
        dashboard_loader = '<script src="/dashboard-polish.js?v=80" defer></script>'
        self.assertEqual(html.count(dashboard_loader), 1)
        self.assertEqual(html.rfind(loader) + len(loader), html.rfind(dashboard_loader),
                         "Dashboard script must follow Quick Poll without entering inline JS")
        studio_loader = '<script src="/million-studio.js?v=1" defer></script>'
        self.assertEqual(html.count(studio_loader), 1)
        self.assertEqual(html.rfind(dashboard_loader) + len(dashboard_loader), html.rfind(studio_loader),
                         "MILLION Studio should follow dashboard without entering inline JS")
        self.assertEqual(html.rfind(studio_loader) + len(studio_loader), html.rfind("</body>"),
                         "Last external script must precede the real final body tag")
        self.assertIn('<link rel="stylesheet" href="/quick-poll.css?v=1">', html)
        self.assertIn('<link rel="stylesheet" href="/dashboard-polish.css?v=80">', html)
        self.assertIn('<link rel="stylesheet" href="/million-studio.css?v=1">', html)

    async def test_anonymous_server_totals_and_private_identity(self):
        poll_id = await self.launch()
        responses = await asyncio.gather(
            self.vote(poll_id, "student-alpha-unique", ["0"]),
            self.vote(poll_id, "student-beta-unique", ["1"]))
        self.assertEqual([response.status for response in responses], [200, 200])
        teacher = await self.get("teacher")
        shared = await self.get("shared")
        beta = await self.get("student", "student-beta-unique")
        self.assertEqual(teacher["counts"], {"0": 1, "1": 1, "2": 0})
        self.assertEqual(shared["counts"], teacher["counts"])
        self.assertNotIn("identifiedVotes", teacher)
        self.assertNotIn("identifiedVotes", shared)
        self.assertEqual(beta["ownVote"], ["1"])
        self.assertNotIn("voter_key", json.dumps(teacher))
        self.assertEqual(app.LATEST_STATE["activityRun"], self.initial_activity,
                         "A poll must never replace a running classroom game")
        # One vote per identity: changing does not double-count a vote.
        res = await self.vote(poll_id, "student-alpha-unique", ["1"])
        self.assertEqual(res.status, 200)
        teacher = await self.get("teacher")
        self.assertEqual(teacher["counts"], {"0": 0, "1": 2, "2": 0})
        with app.db() as con:
            vote_rows = con.execute("SELECT voter_key FROM quick_poll_vote").fetchall()
        self.assertEqual(len(vote_rows), 2)
        self.assertTrue(all("student-" not in row["voter_key"] for row in vote_rows))

    async def test_identified_votes_teacher_only(self):
        poll_id = await self.launch(identity="identified", visibility="live")
        self.assertEqual((await self.vote(poll_id, "student-alpha-unique", ["2"])).status, 200)
        teacher = await self.get("teacher")
        shared = await self.get("shared")
        student = await self.get("student", "student-beta-unique")
        self.assertEqual(teacher["identifiedVotes"][0]["name"], "Alpha")
        self.assertEqual(teacher["identifiedVotes"][0]["choices"], ["2"])
        self.assertNotIn("identifiedVotes", shared)
        self.assertNotIn("identifiedVotes", student)
        self.assertEqual(shared["counts"]["2"], 1)
        self.assertEqual(app.LATEST_STATE["activityRun"], self.initial_activity)

    async def test_hidden_results_and_revote_comparison(self):
        poll_id = await self.launch(visibility="reveal", allowChange=False)
        self.assertEqual((await self.vote(poll_id, "student-alpha-unique", ["0"])).status, 200)
        self.assertEqual((await self.vote(poll_id, "student-alpha-unique", ["1"])).status, 409)
        self.assertIsNone((await self.get("student", "student-beta-unique"))["counts"])
        self.assertIsNone((await self.get("shared"))["counts"])
        await self.control("close")
        self.assertEqual((await self.get("shared"))["counts"]["0"], 1)
        self.assertEqual((await self.vote(poll_id, "student-beta-unique", ["2"])).status, 409)
        await self.control("revote")
        opened = await self.get("teacher")
        self.assertEqual(opened["round"], 2)
        self.assertEqual(opened["before"]["0"], 1)
        self.assertEqual(opened["counts"]["0"], 0)
        self.assertEqual((await self.vote(poll_id, "student-alpha-unique", ["2"])).status, 200)
        await self.control("display", display="donut")
        self.assertEqual((await self.get("shared"))["display"], "donut")
        await self.control("dismiss")
        self.assertIsNone(await self.get("teacher"))
        self.assertEqual(app.LATEST_STATE["activityRun"], self.initial_activity)

    async def test_sensitive_checkin_and_join_security(self):
        poll_id = await self.launch(sensitive=True, identity="identified", visibility="live")
        p = await self.get("teacher")
        self.assertEqual(p["identity"], "anonymous")
        self.assertEqual(p["visibility"], "reveal")
        self.assertEqual((await self.vote(poll_id, "student-alpha-unique", ["0"])).status, 200)
        self.assertEqual((await self.vote(poll_id, "student-beta-unique", ["0"],
            sid="old-class-session")).status, 403)
        self.assertEqual((await self.vote(poll_id, "student-beta-unique", ["0"],
            code="WRONG")).status, 403)
        self.assertEqual((await self.vote(poll_id, "fake-student-token", ["0"])).status, 403)
        await self.control("close")
        shared = await self.get("shared")
        self.assertIsNone(shared["counts"], "Small private groups must not appear on projector")
        self.assertIsNone(shared["voters"])
        self.assertNotIn("identifiedVotes", p)
        self.assertEqual((await self.get("teacher"))["counts"]["0"], 1)

    async def test_shared_screen_presentation_toggle_and_display_modes(self):
        """Only teacher can project, chart selection survives state refresh, votes remain."""
        poll_id = await self.launch()
        initial = await self.get("teacher")
        self.assertFalse(initial["sharedVisible"],
                         "New polls must not unexpectedly take over the shared screen")
        self.assertFalse((await self.get("shared"))["sharedVisible"])
        self.assertEqual((await self.vote(poll_id, "student-alpha-unique", ["0"])).status, 200)
        for mode in ("bars", "donut", "cards"):
            await self.control("display", display=mode)
            await self.control("share", visible=True)
            teacher, shared = await self.get("teacher"), await self.get("shared")
            self.assertTrue(teacher["sharedVisible"])
            self.assertTrue(shared["sharedVisible"])
            self.assertEqual(shared["display"], mode)
            self.assertEqual(shared["counts"]["0"], 1)
            self.assertEqual(shared["question"], "Where should the crew go?")
        invalid = await self.client.post("/api/quick-poll/control",
                                         json={"action": "share", "visible": "false"})
        self.assertEqual(invalid.status, 400)
        self.assertTrue((await self.get("teacher"))["sharedVisible"])
        # Showdown requires exactly 2 options, protect the active presentation.
        invalid = await self.client.post("/api/quick-poll/control",
                                         json={"action": "display", "display": "showdown"})
        self.assertEqual(invalid.status, 400)
        await self.control("share", visible=False)
        self.assertFalse((await self.get("shared"))["sharedVisible"])
        await self.control("close")
        await self.control("reopen")
        self.assertFalse((await self.get("shared"))["sharedVisible"])
        self.assertEqual((await self.get("teacher"))["counts"]["0"], 1)
        self.assertEqual(app.LATEST_STATE["activityRun"], self.initial_activity)
        await self.control("dismiss")
        self.assertIsNone(await self.get("teacher"))

    async def test_multiple_options_templates_timer_and_new_session(self):
        poll_id = await self.launch(multiple=True, limit=2, duration=15)
        self.assertEqual((await self.vote(poll_id, "student-alpha-unique", ["0", "1"])).status, 200)
        self.assertEqual((await self.vote(poll_id, "student-beta-unique", ["0", "1", "2"])).status, 400)
        self.assertEqual((await self.vote(poll_id, "student-beta-unique", ["9"])).status, 400)
        with app.db() as con:
            poll = json.loads(con.execute("SELECT data FROM quick_poll_live WHERE id=1").fetchone()["data"])
            poll["endAt"] = time.time() - 1
            con.execute("UPDATE quick_poll_live SET data=? WHERE id=1", (json.dumps(poll),))
        self.assertEqual((await self.get("teacher"))["phase"], "closed")
        self.assertEqual((await self.vote(poll_id, "student-gamma-unique", ["2"])).status, 409)
        saved = await self.client.post("/api/quick-poll/templates", json={
            "name": "My Moon Poll", "poll": {"question": "Planet?", "choices": [
                {"label": "Moon"}, {"label": "Mars"}]}})
        self.assertEqual(saved.status, 200, await saved.text())
        listing = await self.client.get("/api/quick-poll/templates")
        self.assertEqual(len((await listing.json())["templates"]), 1)
        changed = await self.client.post("/api/session/new", json={})
        self.assertEqual(changed.status, 200)
        self.assertIsNone(await self.get("teacher"))
        listing = await self.client.get("/api/quick-poll/templates")
        self.assertEqual(len((await listing.json())["templates"]), 1)


if __name__ == "__main__":
    unittest.main()
