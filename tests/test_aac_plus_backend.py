"""AAC+ smoke/regression tests: teacher isolation, board sizes, token revocation, media."""
import base64
import io
import tempfile
import unittest
import wave
from pathlib import Path
from aiohttp import web
from aiohttp.test_utils import AioHTTPTestCase
import aac_plus_server

ROOT=Path(__file__).resolve().parents[1]
def cells(n):
    return [{"label":"More" if i==0 else "","symbol":"⭐" if i==0 else "","color":"#075aa0","audio":None,"image":None} for i in range(n)]
def wav(seconds):
    b=io.BytesIO()
    with wave.open(b,"wb") as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(8000);w.writeframes(b"\0\0"*(8000*seconds))
    return "data:audio/wav;base64,"+base64.b64encode(b.getvalue()).decode()
class ACCTest(AioHTTPTestCase):
    async def get_application(self):
        self.temp=tempfile.TemporaryDirectory()
        app=web.Application(client_max_size=8*1024*1024)
        aac_plus_server.install(app,self.temp.name,lambda req:req.cookies.get("test_teacher")=="yes",ROOT)
        return app
    async def tearDownAsync(self):
        await super().tearDownAsync()
        self.temp.cleanup()
    def cookies(self):
        return {"Cookie":"test_teacher=yes"}
    async def create_board(self,size="3x3"):
        dims={"2x3":6,"3x3":9,"4x4":16}
        r=await self.client.post("/api/aac/boards",headers=self.cookies(),json={"title":"Basic Needs","layout":size,"tiles":cells(dims[size])})
        self.assertEqual(r.status,201,await r.text())
        return (await r.json())["id"]
    async def test_no_anonymous_edit_and_all_sizes(self):
        self.assertEqual((await self.client.get("/api/aac/boards")).status,401)
        for size in ("2x3","3x3","4x4"):
            board=await self.create_board(size)
            r=await self.client.get(f"/api/aac/boards/{board}",headers=self.cookies())
            self.assertEqual((await r.json())["layout"],size)
        r=await self.client.get("/api/aac/boards",headers=self.cookies())
        self.assertEqual(len((await r.json())["boards"]),3)
    async def test_revoke_readonly(self):
        board=await self.create_board()
        r=await self.client.post(f"/api/aac/boards/{board}/share",headers=self.cookies())
        self.assertEqual(r.status,200)
        token=(await r.json())["url"].split("/")[-1]
        self.assertEqual((await self.client.get(f"/api/aac/public/{token}")).status,200)
        self.assertEqual((await self.client.put(f"/api/aac/boards/{board}",json={})).status,401)
        self.assertEqual((await self.client.get(f"/aac/s/{token}")).status,200)
        r=await self.client.post(f"/api/aac/boards/{board}/revoke",headers=self.cookies())
        self.assertEqual(r.status,200)
        self.assertEqual((await self.client.get(f"/api/aac/public/{token}")).status,404)
    async def test_audio_duration_and_asset_scope(self):
        upload=await self.client.post("/api/aac/media",headers=self.cookies(),json={"kind":"audio","data":wav(1)})
        self.assertEqual(upload.status,201,await upload.text())
        audio=(await upload.json())["id"]
        bad=await self.client.post("/api/aac/media",headers=self.cookies(),json={"kind":"audio","data":wav(31)})
        self.assertEqual(bad.status,400)
        tiles=cells(6);tiles[0]["audio"]=audio
        r=await self.client.post("/api/aac/boards",headers=self.cookies(),json={"layout":"2x3","title":"Test","tiles":tiles})
        board=(await r.json())["id"]
        r=await self.client.post(f"/api/aac/boards/{board}/share",headers=self.cookies())
        token=(await r.json())["url"].split("/")[-1]
        self.assertEqual((await self.client.get(f"/api/aac/media/audio/{audio}?token={token}")).status,200)
        self.assertEqual((await self.client.get(f"/api/aac/media/audio/{audio}")).status,404)
        await self.client.post(f"/api/aac/boards/{board}/revoke",headers=self.cookies())
        self.assertEqual((await self.client.get(f"/api/aac/media/audio/{audio}?token={token}")).status,404)
    async def test_illustrated_aac_art_pack_and_safe_skin_routes(self):
        for name in ("header.png", "hero.png", "create-button.png", "search-blank.png",
                     "board-shell.png", "edit-button.png", "secondary-button.png",
                     "footer.png", "hologram.png"):
            response=await self.client.get("/aac-plus-art/"+name)
            self.assertEqual(response.status,200,name)
            self.assertEqual(response.content_type,"image/png",name)
            self.assertTrue((await response.read()).startswith(bytes((137,80,78,71,13,10,26,10))),name)
        for name in ("editor-console.svg", "panel-heading.svg", "student-console.svg",
                     "communication-tile.svg", "share-dock.svg", "action-primary.svg",
                     "action-secondary.svg", "action-danger.svg"):
            response=await self.client.get("/aac-plus-v4/"+name)
            self.assertEqual(response.status,200,name)
            self.assertEqual(response.content_type,"image/svg+xml",name)
            self.assertIn(b"<svg",await response.read())
        self.assertEqual((await self.client.get("/aac-plus-v4/not-allowed.svg")).status,404)
        response=await self.client.get("/aac-plus-art/00_aac_plus_full_concept_mockup.png")
        self.assertEqual(response.status,404)
    async def test_kokoro_optional_teacher_gate_and_pilot_voices(self):
        self.assertEqual((await self.client.get("/api/aac/kokoro/status")).status,401)
        self.assertEqual((await self.client.post("/api/aac/kokoro/prepare")).status,401)
        self.assertEqual((await self.client.post("/api/aac/kokoro/generate",json={"text":"Hello","voice":"af_heart"})).status,401)
        resp=await self.client.get("/api/aac/kokoro/status",headers=self.cookies())
        self.assertEqual(resp.status,200)
        payload=await resp.json()
        self.assertFalse(payload["ready"])
        self.assertEqual({v["id"] for v in payload["voices"]},{"af_heart","am_michael"})
        bad=await self.client.post("/api/aac/kokoro/generate",headers=self.cookies(),json={"text":"Hello","voice":"unknown"})
        self.assertEqual(bad.status,400)
        not_ready=await self.client.post("/api/aac/kokoro/generate",headers=self.cookies(),json={"text":"Hello","voice":"af_heart"})
        self.assertEqual(not_ready.status,503)
if __name__=="__main__":unittest.main()
