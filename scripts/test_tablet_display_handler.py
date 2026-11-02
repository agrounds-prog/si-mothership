#!/usr/bin/env python3
"""Exercise the actual shared-display handler with controlled WebSocket clients."""
import ast
import asyncio
import pathlib
import types

source = (pathlib.Path(__file__).resolve().parents[1] / "server.py").read_text(encoding="utf8")
module = ast.parse(source)
handler = next(n for n in module.body if isinstance(n, ast.AsyncFunctionDef) and n.name == "shared_display_status")
# Compile the production handler, not a hand-written reimplementation.
isolated = ast.fix_missing_locations(ast.Module(body=[handler], type_ignores=[]))
class Forbidden(Exception):
    pass
class Web:
    HTTPUnauthorized = Forbidden
    @staticmethod
    def json_response(data, headers=None):
        return data, headers
class Socket:
    def __init__(self, closed=False):
        self.closed = closed

open_live, open_stale, closed_live, student = Socket(), Socket(), Socket(True), Socket()
clients = {
    open_live: {"role": "shared", "session_id": "current"},
    open_stale: {"role": "shared", "session_id": "previous"},
    closed_live: {"role": "shared", "session_id": "current"},
    student: {"role": "student", "session_id": "current"},
}
allowed = True
scope = {
    "web": Web,
    "teacher_authorized": lambda request: allowed,
    "CLIENT_META": clients,
    "CURRENT_SESSION_ID": "current",
}
exec(compile(isolated, "server.py", "exec"), scope)
fn = scope["shared_display_status"]

async def verify():
    global allowed
    data, headers = await fn(object())
    assert data == {"ok": True, "connected_displays": 1}, data
    assert headers["Cache-Control"] == "no-store"
    print("PASS only active current-session shared screen counted")
    open_live.closed = True
    data, _ = await fn(object())
    assert data["connected_displays"] == 0, data
    print("PASS disconnect removes device from count")
    open_live.closed = False
    clients[open_stale]["session_id"] = "current"
    data, _ = await fn(object())
    assert data["connected_displays"] == 2, data
    print("PASS reconnect/current-session device appears in count")
    allowed = False
    try:
        await fn(object())
    except Forbidden:
        print("PASS unauthenticated request denied")
    else:
        raise AssertionError("unauthenticated request accepted")

asyncio.run(verify())
