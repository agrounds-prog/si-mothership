#!/usr/bin/env python3
"""Focused Phase 4U tablet shared-display regression guards.

Run from the repository root:
    python scripts/test_tablet_shared_display.py
"""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
server = (root / "server.py").read_text(encoding="utf-8")
html = (root / "index.html").read_text(encoding="utf-8")

start = server.index("async def shared_display_status(")
end = server.find("\nasync def ", start + 1)
handler = server[start:end if end >= 0 else None]

checks = {
    "teacher authorization": "if not teacher_authorized(request):" in handler,
    "closed connections excluded": "not ws.closed" in handler,
    "only shared role counted": 'meta.get("role") == "shared"' in handler,
    "current session only": 'meta.get("session_id") == CURRENT_SESSION_ID' in handler,
    "count only, no student identities": '"connected_displays": len(displays)' in handler,
    "response disables caching": '"Cache-Control": "no-store"' in handler,
    "authenticated status route": '"/api/teacher/shared-displays", shared_display_status' in server,
    "teacher QR dialog queries status": "'/api/teacher/shared-displays'" in html,
    "QR dialog only uses fresh session URL": "const target=info?.shared_url;" in html,
    "QR dialog supports Escape close": "e.key==='Escape'" in html,
}
for name, passed in checks.items():
    print(f"{'PASS' if passed else 'FAIL'} {name}")
if not all(checks.values()):
    raise SystemExit(1)
