#!/usr/bin/env python3
"""Phase 4V: check existing PIXEL verbal approval flow stays available."""
from pathlib import Path

html = (Path(__file__).resolve().parents[1] / "index.html").read_text(encoding="utf-8")
css = (Path(__file__).resolve().parents[1] / "dashboard-polish.css").read_text(encoding="utf-8")
checks = {
    "verbal answer mode": "cfg.answerMode==='verbal'" in html,
    "spoken approval buttons": 'data-pixel-spoken-correct=' in html and 'data-pixel-spoken-wrong=' in html,
    "teacher overrides correctness": "function setPixelGuessCorrect(name,value)" in html and "g.teacherCorrect=value" in html,
    "spoken controls have touch targets": "button[data-pixel-spoken-correct]" in css and "min-height:44px" in css,
    "student responses remain optional in teacher controls": "No students joined." in html,
}
for name, ok in checks.items():
    print(f"{'PASS' if ok else 'FAIL'} {name}")
if not all(checks.values()):
    raise SystemExit(1)
