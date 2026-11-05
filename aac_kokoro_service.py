"""Kokoro AAC+ optional teacher-only pilot.
Weights/audio are on persistent /data; model inference runs in a child process.
"""
import asyncio
import os
import sys
import uuid
import wave
from pathlib import Path
from aiohttp import web, ClientSession, ClientTimeout

VOICES={"af_heart":"Heart (feminine)","am_michael":"Michael (masculine)"}
FILES=(
 ("kokoro-v1.0.int8.onnx","https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.0.int8.onnx",50000000,150000000),
 ("voices-v1.0.bin","https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.0.bin",10000000,45000000),
)

def install(app,data_dir,root,teacher_authorized):
    base=Path(data_dir)/"aac_plus"
    models=base/"kokoro"
    media=base/"media"
    lock=asyncio.Lock()
    def auth(req):
        if not teacher_authorized(req):raise web.HTTPUnauthorized(text="Teacher sign-in required")
        if req.method!="GET":
            origin=req.headers.get("Origin")
            if origin:
                from urllib.parse import urlsplit
                if urlsplit(origin).netloc!=req.headers.get("Host"):raise web.HTTPForbidden()
    def ready():
        return all((models/name).is_file() and lo <= (models/name).stat().st_size <= hi for name,_,lo,hi in FILES)
    async def status(req):
        auth(req)
        return web.json_response({"ready":ready(),"busy":lock.locked(),
            "voices":[{"id":k,"label":v} for k,v in VOICES.items()]},headers={"Cache-Control":"no-store"})
    async def prepare(req):
        auth(req)
        if lock.locked():raise web.HTTPConflict(text="Kokoro is busy")
        async with lock:
            if ready():return web.json_response({"ready":True,"cached":True})
            models.mkdir(parents=True,exist_ok=True)
            try:
                async with ClientSession(timeout=ClientTimeout(total=240,sock_read=80)) as client:
                    for filename,url,low,high in FILES:
                        dest=models/filename
                        if dest.is_file() and low<=dest.stat().st_size<=high:continue
                        part=models/(filename+".partial")
                        try:
                            async with client.get(url,allow_redirects=True) as response:
                                if response.status!=200:raise RuntimeError("Model download failed")
                                size=0
                                with part.open("wb") as out:
                                    async for chunk in response.content.iter_chunked(524288):
                                        size+=len(chunk)
                                        if size>high:raise RuntimeError("Unexpected model size")
                                        out.write(chunk)
                                if size<low:raise RuntimeError("Incomplete model file")
                            part.replace(dest)
                        finally:
                            part.unlink(missing_ok=True)
            except Exception:
                raise web.HTTPServiceUnavailable(text="Kokoro setup unavailable. Browser speech still works.")
        return web.json_response({"ready":True,"cached":False})
    async def generate(req):
        auth(req)
        data=await req.json()
        phrase=str(data.get("text") or "").strip()
        voice=data.get("voice")
        if voice not in VOICES:raise web.HTTPBadRequest(text="Unsupported voice")
        if not phrase or len(phrase)>120 or len(phrase.split())>25:
            raise web.HTTPBadRequest(text="Use a short phrase of up to 120 characters")
        if not ready():raise web.HTTPServiceUnavailable(text="Prepare Kokoro before generating audio")
        if lock.locked():raise web.HTTPConflict(text="Kokoro is busy")
        media.mkdir(parents=True,exist_ok=True)
        key=uuid.uuid4().hex
        dest=media/(key+".wav")
        async with lock:
            process=None
            try:
                process=await asyncio.create_subprocess_exec(
                    sys.executable,str(Path(root)/"aac_kokoro_generate.py"),
                    "--model",str(models/FILES[0][0]),"--voices",str(models/FILES[1][0]),
                    "--output",str(dest),"--voice",voice,"--text",phrase,
                    stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE,
                    env={**os.environ,"OMP_NUM_THREADS":"1","ORT_NUM_THREADS":"1"},
                )
                output,errors=await asyncio.wait_for(process.communicate(),timeout=110)
                if process.returncode!=0 or not dest.is_file() or dest.stat().st_size>5000000:
                    raise RuntimeError("Generation failed")
                with wave.open(str(dest),"rb") as result:
                    duration=result.getnframes()/result.getframerate()
                    if not 0<duration<=30.02:raise RuntimeError("Audio duration invalid")
            except Exception:
                if process and process.returncode is None:
                    process.kill()
                    await process.communicate()
                dest.unlink(missing_ok=True)
                raise web.HTTPServiceUnavailable(text="Kokoro couldn't generate audio. Browser voice remains available.")
        return web.json_response({"id":key,"voice":voice},status=201)
    app.router.add_get("/api/aac/kokoro/status",status)
    app.router.add_post("/api/aac/kokoro/prepare",prepare)
    app.router.add_post("/api/aac/kokoro/generate",generate)
