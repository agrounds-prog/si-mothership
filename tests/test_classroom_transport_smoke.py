"""Isolated teacher/student/shared WebSocket checks. Never touches production /data."""
import asyncio
import tempfile
import unittest
from pathlib import Path

from aiohttp import WSServerHandshakeError
from aiohttp.test_utils import TestClient, TestServer

import server as app


class ClassroomTransportSmoke(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.original_db = app.DB_PATH
        app.DB_PATH = Path(self.tmp.name) / "classroom-test.sqlite3"
        app.CLIENTS.clear()
        app.CLIENT_META.clear()
        app.init_db()
        self.client = TestClient(TestServer(app.create_app()))
        await self.client.start_server()
        self.sockets = []

    async def asyncTearDown(self):
        for ws in self.sockets:
            if not ws.closed:
                await ws.close()
        await self.client.close()
        app.CLIENTS.clear()
        app.CLIENT_META.clear()
        app.DB_PATH = self.original_db
        self.tmp.cleanup()

    async def ws(self, role, code="", sid=""):
        url = "/ws?role=" + role
        if code:
            url += "&code=" + code
        if sid:
            url += "&sid=" + sid
        socket = await self.client.ws_connect(url)
        self.sockets.append(socket)
        return socket

    async def wait_for(self, ws, kind):
        for _ in range(8):
            item = await ws.receive_json(timeout=3)
            if item.get("type") == kind:
                return item
        self.fail("No " + kind + " message from websocket")

    async def login(self):
        response = await self.client.post(
            "/api/teacher/login", json={"key": app.TEACHER_KEY, "remember": False}
        )
        self.assertEqual(response.status, 200)

    async def test_roles_join_and_expired_sessions(self):
        health = await (await self.client.get("/api/health")).json()
        self.assertTrue(health["ok"])
        self.assertEqual(health["client_roles"]["teacher"], 0)

        with self.assertRaises(WSServerHandshakeError) as cm:
            await self.ws("teacher")
        self.assertEqual(cm.exception.status, 401)
        with self.assertRaises(WSServerHandshakeError) as cm:
            await self.ws("student", code="ZZZZ")
        self.assertEqual(cm.exception.status, 403)
        with self.assertRaises(WSServerHandshakeError) as cm:
            await self.ws("shared", sid="expired-session")
        self.assertEqual(cm.exception.status, 403)

        await self.login()
        teacher = await self.ws("teacher")
        student = await self.ws("student", app.CURRENT_JOIN_CODE, app.CURRENT_SESSION_ID)
        student2 = await self.ws("student", app.CURRENT_JOIN_CODE, app.CURRENT_SESSION_ID)
        shared = await self.ws("shared", sid=app.CURRENT_SESSION_ID)
        for ws in (teacher, student, student2, shared):
            self.assertEqual((await self.wait_for(ws, "join_code"))["type"], "join_code")
        health = await (await self.client.get("/api/health")).json()
        self.assertEqual(health["client_roles"]["teacher"], 1)
        self.assertEqual(health["client_roles"]["student"], 2)
        self.assertEqual(health["client_roles"]["shared"], 1)

    async def test_teacher_authority_shared_readonly_and_student_reconnect(self):
        await self.login()
        teacher = await self.ws("teacher")
        shared = await self.ws("shared", sid=app.CURRENT_SESSION_ID)
        student = await self.ws("student", app.CURRENT_JOIN_CODE, app.CURRENT_SESSION_ID)
        for ws in (teacher, shared, student):
            await self.wait_for(ws, "join_code")

        await shared.send_json({"type": "state", "state": {"screen": "hijacked"}})
        await asyncio.sleep(0.05)
        self.assertIsNone(app.LATEST_STATE, "Shared screen must never write state")

        baseline = {"screen": "classroom", "students": [], "activityRun": None,
                    "buzz": [], "helpMessages": [], "photos": [], "ended": False}
        await teacher.send_json({"type": "state", "state": baseline})
        for _ in range(30):
            if app.LATEST_STATE is not None:
                break
            await asyncio.sleep(0.02)
        self.assertEqual(app.LATEST_STATE["screen"], "classroom")
        await student.send_json({"type": "state", "state": {"screen": "hijacked",
                                                        "students": []}})
        await asyncio.sleep(0.06)
        self.assertEqual(app.LATEST_STATE["screen"], "classroom",
                         "Unaffiliated student cannot overwrite teacher screen")

        await student.close()
        recovered = await self.ws("student", app.CURRENT_JOIN_CODE,
                                  app.CURRENT_SESSION_ID)
        state = await self.wait_for(recovered, "state")
        self.assertEqual(state["state"]["screen"], "classroom")


    async def test_two_students_concurrent_buzz_merges_and_identity_is_locked(self):
        await self.login()
        teacher = await self.ws("teacher")
        alpha = await self.ws("student", app.CURRENT_JOIN_CODE, app.CURRENT_SESSION_ID)
        beta = await self.ws("student", app.CURRENT_JOIN_CODE, app.CURRENT_SESSION_ID)
        for socket in (teacher, alpha, beta):
            await self.wait_for(socket, "join_code")

        roster = [{"n": "Alpha", "studentToken": "token-alpha", "c": "#445566"},
                  {"n": "Beta", "studentToken": "token-beta", "c": "#667788"}]
        baseline = {"screen": "classroom", "students": roster, "activityRun": None,
                    "buzz": [], "buzzEnabled": True, "handEnabled": True,
                    "alerts": [], "helpMessages": [], "photos": [], "ended": False}
        await teacher.send_json({"type": "state", "state": baseline})
        for _ in range(30):
            if app.LATEST_STATE is not None:
                break
            await asyncio.sleep(0.02)

        await alpha.send_json({"type": "hello", "student_token": "token-alpha",
                               "student_name": "Alpha"})
        await beta.send_json({"type": "hello", "student_token": "token-beta",
                              "student_name": "Beta"})

        async def buzz(socket, student):
            await socket.send_json({"type": "state",
                                    "state": {"screen": "hijacked",
                                              "students": [student],
                                              "buzz": [student["n"]]}})
        await asyncio.gather(buzz(alpha, roster[0]), buzz(beta, roster[1]))
        for _ in range(40):
            if set(app.LATEST_STATE.get("buzz", [])) == {"Alpha", "Beta"}:
                break
            await asyncio.sleep(0.025)
        self.assertEqual(set(app.LATEST_STATE.get("buzz", [])), {"Alpha", "Beta"})
        self.assertEqual(app.LATEST_STATE["screen"], "classroom")

        # Alpha cannot switch its established socket identity to Beta.
        await alpha.send_json({"type": "hello", "student_token": "token-beta",
                               "student_name": "Beta"})
        await alpha.send_json({"type": "state",
                               "state": {"students": [roster[1]], "buzz": []}})
        await asyncio.sleep(0.08)
        self.assertEqual(set(app.LATEST_STATE.get("buzz", [])), {"Alpha", "Beta"})


if __name__ == "__main__":
    unittest.main()
