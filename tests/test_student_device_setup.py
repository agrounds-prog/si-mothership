"""Regress the Windows student shortcut installer without executing Windows code."""
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from aiohttp.test_utils import TestClient, TestServer
import server


class StudentDeviceSetupTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = TemporaryDirectory(prefix="mothership-launcher-test-")
        self.previous_db_path = server.DB_PATH
        server.DB_PATH = Path(self.directory.name) / "test.sqlite3"
        server.init_db()  # The real app initializes the database before startup.
        self.client = TestClient(TestServer(server.create_app()))
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()
        server.DB_PATH = self.previous_db_path
        self.directory.cleanup()

    async def test_dedicated_teacher_link_cannot_inherit_student_role(self):
        response = await self.client.get("/teacher")
        self.assertEqual(response.status, 200)
        html = await response.text()
        self.assertIn("SI Mothership", html)
        self.assertIn("const SESSION_ROLE=new URLSearchParams(location.search).get('role')||'teacher'", html)
        self.assertIn('id="teacher" class="view active"', html)
        self.assertIn("window.__SI_TEACHER_AUTHENTICATED__=false", html)
        # Even a stale student URL suffix must be removed at this dedicated path.
        stale = await self.client.get("/teacher?role=student&code=BAD1", allow_redirects=False)
        self.assertEqual(stale.status, 302)
        self.assertEqual(stale.headers["Location"], "/teacher")
        slash = await self.client.get("/teacher/")
        self.assertEqual(slash.status, 200)

    async def test_windows_shortcut_is_downloadable_and_contains_only_public_student_entry(self):
        response = await self.client.get("/student-device-setup.cmd")
        self.assertEqual(response.status, 200)
        self.assertIn("application/octet-stream", response.headers["Content-Type"])
        self.assertIn("attachment;", response.headers["Content-Disposition"])
        self.assertIn("SI-Mothership-Student-Setup.cmd", response.headers["Content-Disposition"])
        self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
        data = (await response.read()).decode("utf-8")
        self.assertIn("--app=https://mothership-web-production.up.railway.app/?role=student", data)
        self.assertIn("--window-size=440,830", data)
        self.assertIn("SI Mothership Student.lnk", data)
        self.assertIn("CreateShortcut", data)
        self.assertIn("Start-Process", data)
        self.assertIn("Google\\Chrome", data)
        self.assertIn("Microsoft\\Edge", data)
        self.assertIn("SI-Mothership-Student", data)
        self.assertNotIn("role=teacher", data)
        self.assertNotIn("--start-maximized", data)
        self.assertNotIn("ExecutionPolicy Bypass", data)
        self.assertNotIn("http://", data)
        self.assertNotIn("studentToken", data)
        self.assertNotIn("sid=", data)
        self.assertNotIn("code=", data)

    async def test_teacher_sees_download_but_student_has_no_second_choice(self):
        teacher = await self.client.get("/?role=teacher")
        self.assertEqual(teacher.status, 200)
        t = await teacher.text()
        self.assertIn('id="copyCode"', t)
        self.assertIn('class="si-student-setup-link" href="/student-device-setup.cmd"', t)
        student = await self.client.get("/?role=student")
        self.assertEqual(student.status, 200)
        s = await student.text()
        # The teacher toolbar is in the common HTML but hidden in student mode.
        self.assertIn('id="teacher" class="view', s)
        self.assertIn('id="student" class="view"', s)
        self.assertEqual((await self.client.get("/api/health")).status, 200)
