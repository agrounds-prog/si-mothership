"""Mothership AAC+ standalone soundboard service (independent of live classroom).
Uses existing teacher cookie and the persistent MOTHERSHIP_DATA_DIR. All teacher
writes are checked server-side; public access is via revocable opaque tokens.
"""
from __future__ import annotations
import base64
import hashlib
import io
import json
import os
import re
import secrets
import sqlite3
import time
import uuid
import wave
from pathlib import Path
from urllib.parse import urlsplit
from functools import lru_cache
from aiohttp import web
from PIL import Image, ImageDraw
import qrcode

LAYOUTS = {"2x3": (2, 3), "3x3": (3, 3), "4x4": (4, 4)}
COLORS = {"#075aa0","#184d78","#2b2b73","#0a937d","#d14c59","#e49b26","#a34fc9","#2677c5","#f2b83d","#16a85f"}
MAX_JSON = 6_000_000
MAX_IMAGE = 2_000_000
MAX_AUDIO = 5_000_000
MAX_BOARDS = 250

def install(app, data_dir, teacher_authorized, root, public_base_url=""):
    storage = Path(data_dir) / "aac_plus"
    storage.mkdir(parents=True, exist_ok=True)
    (storage / "media").mkdir(exist_ok=True)
    dbpath = storage / "aac.sqlite3"

    def conn():
        db=sqlite3.connect(dbpath,timeout=15)
        db.row_factory=sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("PRAGMA busy_timeout=15000")
        return db
    with conn() as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("""CREATE TABLE IF NOT EXISTS boards(
           id TEXT PRIMARY KEY, title TEXT NOT NULL, layout TEXT NOT NULL,
           tiles TEXT NOT NULL, created REAL NOT NULL, updated REAL NOT NULL)""")
        db.execute("""CREATE TABLE IF NOT EXISTS shares(
           board_id TEXT PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
           token_hash TEXT NOT NULL UNIQUE, created REAL NOT NULL)""")
        db.execute("CREATE INDEX IF NOT EXISTS idx_aac_share_token ON shares(token_hash)")
    def auth(req):
        if not teacher_authorized(req):
            raise web.HTTPUnauthorized(text="Teacher sign-in required")
        if req.method not in ("GET","HEAD"):
            origin=req.headers.get("Origin")
            host=req.headers.get("Host","")
            if origin and urlsplit(origin).netloc != host:
                raise web.HTTPForbidden(text="Cross-origin request denied")
    def board_id(value):
        if not isinstance(value,str) or not re.fullmatch(r"[0-9a-f]{32}",value):
            raise web.HTTPBadRequest(text="Invalid board id")
        return value
    def token_hash(token):
        if not re.fullmatch(r"[a-zA-Z0-9_-]{32,128}",token or ""):
            raise web.HTTPNotFound(text="Board link is unavailable")
        return hashlib.sha256(token.encode()).hexdigest()
    def read_json(req):
        if req.content_length and req.content_length > MAX_JSON: raise web.HTTPRequestEntityTooLarge(max_size=MAX_JSON,actual_size=req.content_length)
        return req.json()
    def payload(data):
        title=str(data.get("title") or "Untitled Board").strip()[:90]
        layout=str(data.get("layout") or "3x3")
        if layout not in LAYOUTS: raise web.HTTPBadRequest(text="Supported sizes are 2x3, 3x3, 4x4")
        count=LAYOUTS[layout][0]*LAYOUTS[layout][1]
        cells=data.get("tiles",[])
        if not isinstance(cells,list) or len(cells)!=count: raise web.HTTPBadRequest(text="Invalid tile count")
        out=[]
        for t in cells:
            if not isinstance(t,dict): raise web.HTTPBadRequest(text="Invalid tile")
            name=str(t.get("label") or "")[:70]
            icon=str(t.get("symbol") or "")[:4]
            color=str(t.get("color") or "#075aa0").lower()
            if color not in COLORS: color="#075aa0"
            image=t.get("image")
            audio=t.get("audio")
            if image and (not isinstance(image,str) or not re.fullmatch(r"[a-z0-9]{32}",image)):raise web.HTTPBadRequest(text="Invalid image")
            if audio and (not isinstance(audio,str) or not re.fullmatch(r"[a-z0-9]{32}",audio)):raise web.HTTPBadRequest(text="Invalid audio")
            out.append({"label":name,"symbol":icon,"color":color,"image":image or None,"audio":audio or None})
        return title,layout,out
    def raw_board(row):
        return {"id":row["id"],"title":row["title"],"layout":row["layout"],"tiles":json.loads(row["tiles"]),"updated":row["updated"]}
    def ensure_assets(tiles):
        for t in tiles:
            for kind in ("audio","image"):
                v=t.get(kind)
                if v and not (storage/"media"/(v+(".wav" if kind=="audio" else ".png"))).is_file():
                    raise web.HTTPBadRequest(text="An uploaded file is missing")
    def get_board(db,bid):
        row=db.execute("SELECT * FROM boards WHERE id=?",(bid,)).fetchone()
        if row is None:raise web.HTTPNotFound(text="Board not found")
        return row
    def get_public(db,token):
        sh=db.execute("SELECT board_id FROM shares WHERE token_hash=?",(token_hash(token),)).fetchone()
        if sh is None:raise web.HTTPNotFound(text="This shared board is unavailable or revoked")
        return get_board(db,sh["board_id"])

    async def library(req):
        auth(req)
        with conn() as db:
            rows=db.execute("SELECT b.id,b.title,b.layout,b.updated, CASE WHEN s.board_id IS NULL THEN 0 ELSE 1 END AS shared FROM boards b LEFT JOIN shares s ON s.board_id=b.id ORDER BY b.updated DESC").fetchall()
        return web.json_response({"boards":[dict(r) for r in rows]})
    async def create(req):
        auth(req); data=await read_json(req); title,layout,tiles=payload(data);ensure_assets(tiles)
        now=time.time();bid=uuid.uuid4().hex
        with conn() as db:
            if db.execute("SELECT count(*) FROM boards").fetchone()[0]>=MAX_BOARDS: raise web.HTTPBadRequest(text="Board limit reached")
            db.execute("INSERT INTO boards VALUES(?,?,?,?,?,?)",(bid,title,layout,json.dumps(tiles),now,now))
        return web.json_response({"id":bid},status=201)
    async def detail(req):
        auth(req);bid=board_id(req.match_info["id"])
        with conn() as db: row=get_board(db,bid)
        return web.json_response(raw_board(row))
    async def update(req):
        auth(req);bid=board_id(req.match_info["id"])
        data=await read_json(req);title,layout,tiles=payload(data);ensure_assets(tiles)
        with conn() as db:
            get_board(db,bid)
            db.execute("UPDATE boards SET title=?,layout=?,tiles=?,updated=? WHERE id=?",(title,layout,json.dumps(tiles),time.time(),bid))
        return web.json_response({"ok":True})
    async def duplicate(req):
        auth(req);bid=board_id(req.match_info["id"])
        with conn() as db:
            row=get_board(db,bid)
            if db.execute("SELECT count(*) FROM boards").fetchone()[0]>=MAX_BOARDS: raise web.HTTPBadRequest(text="Board limit reached")
            new=uuid.uuid4().hex;t=time.time()
            db.execute("INSERT INTO boards VALUES(?,?,?,?,?,?)",(new,row["title"]+" Copy",row["layout"],row["tiles"],t,t))
        return web.json_response({"id":new},status=201)
    async def delete(req):
        auth(req);bid=board_id(req.match_info["id"])
        with conn() as db:
            get_board(db,bid)
            db.execute("DELETE FROM boards WHERE id=?",(bid,))
        return web.json_response({"ok":True})
    async def share(req):
        auth(req);bid=board_id(req.match_info["id"])
        with conn() as db:
            get_board(db,bid)
            token=secrets.token_urlsafe(32)
            db.execute("INSERT OR REPLACE INTO shares VALUES(?,?,?)",(bid,token_hash(token),time.time()))
        # Replacing an existing token revokes its old link immediately.
        # Use the configured public HTTPS origin behind Railway reverse proxies.
        base=(public_base_url or (f"https://{req.host}" if req.headers.get("X-Forwarded-Proto")=="https" else f"{req.scheme}://{req.host}")).rstrip("/")
        url=f"{base}/aac/s/{token}"
        qr=qrcode.QRCode(box_size=5,border=2);qr.add_data(url);qr.make(fit=True)
        out=io.BytesIO();qr.make_image(fill_color="black",back_color="white").save(out,format="PNG")
        return web.json_response({"url":url,"qr":"data:image/png;base64,"+base64.b64encode(out.getvalue()).decode(),"warning":"Anyone with the link can view and play this board. Do not include confidential student information."})
    async def revoke(req):
        auth(req);bid=board_id(req.match_info["id"])
        with conn() as db:
            get_board(db,bid)
            db.execute("DELETE FROM shares WHERE board_id=?",(bid,))
        return web.json_response({"ok":True})
    async def student(req):
        token=req.match_info["token"]
        with conn() as db: get_public(db,token)
        return web.FileResponse(Path(root)/"aac-plus-student.html",headers={"Cache-Control":"no-store"})
    async def public_board(req):
        with conn() as db: row=get_public(db,req.match_info["token"])
        result=raw_board(row);result.pop("updated",None);result.pop("id",None)
        return web.json_response(result,headers={"Cache-Control":"no-store"})
    def media_path(key,kind):
        if not re.fullmatch(r"[a-z0-9]{32}",key or ""):raise web.HTTPNotFound()
        if kind not in ("image","audio"):raise web.HTTPNotFound()
        p=storage/"media"/(key+(".wav" if kind=="audio" else ".png"))
        if not p.exists():raise web.HTTPNotFound()
        return p
    async def asset(req):
        kind=req.match_info["kind"];key=req.match_info["key"]
        token=req.query.get("token","")
        if not teacher_authorized(req):
            with conn() as db:
                row=get_public(db,token)
                cells=json.loads(row["tiles"])
                if not any(t.get(kind)==key for t in cells):raise web.HTTPForbidden(text="Asset not included in this board")
        p=media_path(key,kind)
        return web.FileResponse(p,headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"})
    async def upload(req):
        auth(req);data=await read_json(req)
        kind=data.get("kind")
        if kind not in ("audio","image"):raise web.HTTPBadRequest(text="Unsupported media type")
        encoded=data.get("data","")
        if not isinstance(encoded,str) or len(encoded)>MAX_JSON:raise web.HTTPBadRequest(text="File too large")
        try:
            head,value=encoded.split(",",1);raw=base64.b64decode(value,validate=True)
        except Exception:raise web.HTTPBadRequest(text="Invalid media file")
        if kind=="audio":
            if len(raw)>MAX_AUDIO:raise web.HTTPBadRequest(text="Audio exceeds file limit")
            try:
                with wave.open(io.BytesIO(raw)) as w:
                    if w.getnchannels() not in (1,2) or w.getsampwidth() not in (1,2) or not 8000<=w.getframerate()<=96000:raise ValueError("Unsupported audio format")
                    dur=w.getnframes()/w.getframerate()
                    if dur<=0 or dur>30.02:raise ValueError("Audio must be 30 seconds or less")
            except Exception:raise web.HTTPBadRequest(text="Use WAV audio of 30 seconds or less")
            ext=".wav"
        else:
            if len(raw)>MAX_IMAGE:raise web.HTTPBadRequest(text="Image exceeds 2 MB")
            # Accept only actual PNG, not arbitrary data/HTML or SVG.
            if not raw.startswith(b"\x89PNG\r\n\x1a\n"):raise web.HTTPBadRequest(text="Use a PNG image")
            if len(raw)<24:raise web.HTTPBadRequest(text="Invalid PNG")
            w=int.from_bytes(raw[16:20],"big");h=int.from_bytes(raw[20:24],"big")
            if not 1<=w<=3000 or not 1<=h<=3000:raise web.HTTPBadRequest(text="Image dimensions must be at most 3000 pixels")
            ext=".png"
        key=uuid.uuid4().hex
        path=storage/"media"/(key+ext)
        with open(path,"xb") as out:out.write(raw)
        return web.json_response({"id":key},status=201)
    async def launch(req):
        auth(req)
        return web.FileResponse(Path(root)/"aac-plus-teacher.html",headers={"Cache-Control":"no-store"})
    def static(filename,mime):
        async def page(req):return web.FileResponse(Path(root)/filename,headers={"Cache-Control":"no-store","Content-Type":mime})
        return page

    # AAC+ v4 vector hardware frames; decorative only, never contain board data.
    FRAME_FILES = {
        "editor-console.svg", "panel-heading.svg", "student-console.svg",
        "communication-tile.svg", "share-dock.svg",
        "action-primary.svg", "action-secondary.svg", "action-danger.svg",
    }

    async def aac_vector_frame(request):
        name = request.match_info["name"]
        if name not in FRAME_FILES:
            raise web.HTTPNotFound()
        path = Path(root) / "assets" / "aac-plus-v4" / name
        if not path.is_file():
            raise web.HTTPNotFound()
        return web.FileResponse(path, headers={
            "Cache-Control": "public, max-age=86400",
            "Content-Type": "image/svg+xml",
            "X-Content-Type-Options": "nosniff",
        })
    app.router.add_get("/aac-plus-v4/{name}", aac_vector_frame)

    # Versioned, allowlisted illustration pack uploaded to GitHub. The original
    # generated art contains example labels; create clean reusable skins here so
    # every saved board retains its OWN name, layout and live button handlers.
    ART_FILES = {
        "header.png": "01_aac_header_shell.png",
        "hero.png": "02_aac_hero_banner.png",
        "create-button.png": "03_create_board_button.png",
        "search-blank.png": "04_search_bar.png",
        "board-shell.png": "05_saved_board_card.png",
        "edit-button.png": "06_edit_button.png",
        "secondary-button.png": "07_share_button.png",
        "footer.png": "08_footer_console_trim.png",
        "hologram.png": "09_center_hologram_emblem.png",
    }

    @lru_cache(maxsize=16)
    def render_ui_art(name):
        source = Path(root) / "aac_plus_asset_pack" / ART_FILES[name]
        with Image.open(source) as source_image:
            artwork = source_image.convert("RGBA")
        if name == "search-blank.png":
            # Remove baked placeholder: actual input text is searchable/editable.
            ImageDraw.Draw(artwork).rounded_rectangle(
                (362, 284, 1370, 394), radius=12, fill=(7, 27, 49, 255))
        elif name == "board-shell.png":
            draw = ImageDraw.Draw(artwork)
            # Preserve the generated 3D armor and illuminated preview bezel.
            # Clear the example tiles/name/buttons before overlaying live DOM.
            draw.rounded_rectangle(
                (250, 207, 817, 594), radius=24,
                fill=(4, 28, 54, 255), outline=(20, 100, 147, 255), width=4)
            draw.rounded_rectangle(
                (202, 657, 870, 841), radius=8, fill=(6, 27, 51, 255))
            draw.rounded_rectangle(
                (190, 845, 896, 1177), radius=11, fill=(5, 21, 41, 255))
            draw.line((205, 826, 855, 826), fill=(35, 118, 165, 255), width=2)
        elif name == "secondary-button.png":
            # One button skin works with live labels: Share, Duplicate, Delete,
            # editor actions and saved-board controls.
            ImageDraw.Draw(artwork).rounded_rectangle(
                (572, 342, 1185, 570), radius=24, fill=(11, 35, 67, 255))
        # Images have enormous transparent generator margins. Crop to meaningful
        # alpha so CSS can size the actual graphic rather than its empty canvas.
        alpha = artwork.getchannel("A").point(lambda px: 255 if px > 52 else 0)
        bounds = alpha.getbbox()
        if bounds:
            pad = 5
            artwork = artwork.crop((
                max(0, bounds[0] - pad), max(0, bounds[1] - pad),
                min(artwork.width, bounds[2] + pad),
                min(artwork.height, bounds[3] + pad),
            ))
        buffer = io.BytesIO()
        artwork.save(buffer, "PNG", optimize=True)
        return buffer.getvalue()

    async def ui_art(req):
        name = req.match_info["name"]
        if name not in ART_FILES:
            raise web.HTTPNotFound()
        try:
            body = render_ui_art(name)
        except (OSError, ValueError):
            raise web.HTTPNotFound()
        return web.Response(body=body, content_type="image/png", headers={
            "Cache-Control": "public, max-age=86400",
            "X-Content-Type-Options": "nosniff",
        })
    app.router.add_get("/aac-plus-art/{name}", ui_art)

    app.router.add_get("/aac",launch)
    app.router.add_get("/aac/",launch)
    app.router.add_get("/aac/s/{token}",student)
    app.router.add_get("/aac-plus.css",static("aac-plus.css","text/css"))
    app.router.add_get("/aac-plus.js",static("aac-plus.js","application/javascript"))
    app.router.add_get("/api/aac/boards",library)
    app.router.add_post("/api/aac/boards",create)
    app.router.add_get("/api/aac/boards/{id}",detail)
    app.router.add_put("/api/aac/boards/{id}",update)
    app.router.add_delete("/api/aac/boards/{id}",delete)
    app.router.add_post("/api/aac/boards/{id}/duplicate",duplicate)
    app.router.add_post("/api/aac/boards/{id}/share",share)
    app.router.add_post("/api/aac/boards/{id}/revoke",revoke)
    app.router.add_post("/api/aac/media",upload)
    app.router.add_get("/api/aac/media/{kind}/{key}",asset)
    app.router.add_get("/api/aac/public/{token}",public_board)
    import aac_kokoro_service
    aac_kokoro_service.install(app, data_dir, root, teacher_authorized)
