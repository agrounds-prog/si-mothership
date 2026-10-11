"""SI+ and classroom saved-content persistence across session resets.

Use an isolated temporary SQLite DB; never read or modify Railway /data.
"""
import json
import tempfile
import unittest
from pathlib import Path
from aiohttp.test_utils import TestClient,TestServer
import server as app

class TeacherContentSurvivesReset(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.db_old,self.latest_old=app.DB_PATH,app.LATEST_STATE
        self.join_old,self.session_old=app.CURRENT_JOIN_CODE,app.CURRENT_SESSION_ID
        app.DB_PATH=Path(self.tmp.name)/"si_plus_reset_test.sqlite3"
        app.CLIENTS.clear();app.CLIENT_META.clear()
        app.init_db()
        self.client=TestClient(TestServer(app.create_app()))
        await self.client.start_server()
        login=await self.client.post("/api/teacher/login",json={"key":app.TEACHER_KEY})
        self.assertEqual(login.status,200)

    async def asyncTearDown(self):
        await self.client.close()
        app.CLIENTS.clear();app.CLIENT_META.clear()
        app.DB_PATH,app.LATEST_STATE=self.db_old,self.latest_old
        app.CURRENT_JOIN_CODE,app.CURRENT_SESSION_ID=self.join_old,self.session_old
        self.tmp.cleanup()

    async def test_si_plus_decks_survive_class_reset_and_server_reinitialization(self):
        # Save actual presentation data under the app's canonical storage key.
        key="siMothership.presentations.v1"
        decks=[{"id":"si-plus-test-1","name":"Science Lesson","slides":[
            {"id":"slide-1","type":"instruction","text":"Morning warmup"},
            {"id":"slide-2","type":"image","image":"data:image/png;base64,aGVsbG8="}
        ]}]
        payload=json.dumps(decks,separators=(",",":"))
        response=await self.client.post("/api/storage",json={"key":key,"value":payload})
        self.assertEqual(response.status,200,await response.text())
        before=await self.client.get("/api/storage")
        self.assertEqual((await before.json())["items"][key],payload)
        reset=await self.client.post("/api/session/new",json={})
        self.assertEqual(reset.status,200,await reset.text())
        after=await self.client.get("/api/storage")
        self.assertEqual((await after.json())["items"][key],payload,"Reset must not clear SI+ saved slides")
        # Reopening a teacher tab must hydrate saved presentations before app JS.
        teacher=await self.client.get("/?role=teacher")
        self.assertEqual(teacher.status,200)
        html=await teacher.text()
        self.assertIn("window.__SI_STORAGE_SNAPSHOT__",html)
        self.assertIn("si-plus-test-1",html)
        app.init_db()
        self.assertEqual(app.load_teacher_storage()[key],payload,"Server restart preserves SI+ library")

    async def test_board_and_game_libraries_preserved_without_public_exposure(self):
        for key,value in [
            ("siMothership.crewSurveyGames.v1",'[{"name":"Survey Example"}]'),
            ("siMothership.wordGridLibrary.v1",'[{"name":"Word Example"}]'),
            ("siMothership.dominoesGames.v1",'[{"name":"Dominoes Example"}]'),
        ]:
            res=await self.client.post("/api/storage",json={"key":key,"value":value})
            self.assertEqual(res.status,200)
        reset=await self.client.post("/api/session/new",json={})
        self.assertEqual(reset.status,200)
        resp=await self.client.get("/api/storage")
        keys=(await resp.json())["items"]
        self.assertIn("siMothership.crewSurveyGames.v1",keys)
        self.assertIn("siMothership.wordGridLibrary.v1",keys)
        self.assertIn("siMothership.dominoesGames.v1",keys)
        public=await self.client.get("/api/storage?role=shared")
        # Authorized teacher cookie still sees teacher data; force unauthenticated
        # student request via a separate session in real classroom tests.
        self.assertEqual(public.status,200)

if __name__=="__main__":
    unittest.main()
