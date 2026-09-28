#!/usr/bin/env python3
"""SI Mothership release regression gate.

Run:
  python scripts/release_gate.py
  python scripts/release_gate.py --require-node

The stricter form is used in CI and validates the inline JavaScript with Node.
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SERVER = ROOT / "server.py"

failures: list[str] = []
passes: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    if condition:
        passes.append(name)
        print(f"PASS  {name}")
    else:
        failures.append(name)
        print(f"FAIL  {name}" + (f" — {detail}" if detail else ""))


def segment(text: str, marker: str, next_markers: tuple[str, ...] = ("\nfunction ", "\ndef ")) -> str:
    start = text.find(marker)
    if start < 0:
        return ""
    ends = [text.find(m, start + len(marker)) for m in next_markers]
    ends = [x for x in ends if x >= 0]
    end = min(ends) if ends else min(len(text), start + 12000)
    return text[start:end]


def quoted_set(text: str, name: str) -> set[str]:
    m = re.search(rf"{re.escape(name)}\s*=\s*\{{(.*?)\}}", text, re.S)
    return set(re.findall(r'["\']([^"\']+)["\']', m.group(1))) if m else set()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--require-node", action="store_true", help="fail if Node is unavailable for JS parse validation")
    args = parser.parse_args()

    html = INDEX.read_text(encoding="utf-8")
    server = SERVER.read_text(encoding="utf-8")

    # Version consistency.
    title_version = re.search(r"<title>[^<]*v(\d+\.\d+)", html)
    server_version = re.search(r'APP_VERSION\s*=\s*"([^"]+)"', server)
    check("version: title and server match", bool(title_version and server_version and title_version.group(1) == server_version.group(1)))

    # Inline JavaScript parse validation.
    scripts = re.findall(r"<script[^>]*>(.*?)</script>", html, flags=re.S | re.I)
    node = shutil.which("node")
    if node:
        parse_ok = True
        parse_detail = ""
        for i, script in enumerate(scripts, 1):
            if not script.strip():
                continue
            p = subprocess.run(
                [node, "-e", "new Function(require('fs').readFileSync(0,'utf8'))"],
                input=script,
                text=True,
                capture_output=True,
            )
            if p.returncode:
                parse_ok = False
                parse_detail = f"script {i}: {p.stderr.strip()[:500]}"
                break
        check("javascript: inline scripts parse", parse_ok, parse_detail)
    else:
        check("javascript: Node available for strict parse", not args.require_node, "install Node or omit --require-node")

    # Historical selector invariant: $() is single-element; $$() is multi-element.
    bad_selector_lines = []
    for number, line in enumerate(html.splitlines(), 1):
        if re.search(r"(?<!\$)\$\([^;\n]*\)\.forEach\s*\(", line):
            bad_selector_lines.append(number)
    check("selectors: no $().forEach misuse", not bad_selector_lines, f"lines {bad_selector_lines[:10]}")

    # All supported launch paths must feed the teacher session summary tracker.
    launch_functions = [
        "launchActivityById",
        "launchMinefield",
        "launchVector",
        "launchBoard",
        "openSavedBoard",
        "launchOrbit",
        "launchPixel",
        "launchSketchSignal",
        "launchStarwheel",
    ]
    missing_launch_hooks = [
        name for name in launch_functions
        if "recordActivityLaunch(" not in segment(html, f"function {name}(")
    ]
    check("summary: all major launch paths call recordActivityLaunch", not missing_launch_hooks, ", ".join(missing_launch_hooks))

    # Teacher-only persistence boundaries.
    public_keys = quoted_set(server, "PUBLIC_STORAGE_KEYS")
    persisted_keys = quoted_set(server, "PERSISTED_STORAGE_KEYS")
    teacher_only_keys = {
        "siMothership.activityPresets.v1",
        "siMothership.recentActivities.v1",
        "siMothership.sessionHistory.v1",
    }
    check("privacy: teacher keys are server-persisted", teacher_only_keys <= persisted_keys)
    check("privacy: teacher keys are not public storage", teacher_only_keys.isdisjoint(public_keys), str(sorted(teacher_only_keys & public_keys)))
    forbidden_state_fields = ("state.sessionHistory", "state.activityPresets", "state.recentActivities", "state.teacherSessionSummary")
    check("privacy: teacher bookkeeping remains outside synchronized state", not any(x in html for x in forbidden_state_fields))
    shared_snapshot = segment(html, "function sharedStateSnapshot(")
    check("privacy: shared snapshot has no teacher-history key references", not any(k in shared_snapshot for k in teacher_only_keys))

    # Classroom workflow lifecycle.
    pause = segment(html, "function sendActivityToLobby(")
    finish = segment(html, "function finishActiveActivity(")
    returned = segment(html, "function returnToClassroom(")
    check("workflow: pause preserves activityRun", "resumePending=true" in pause and "phase='lobby'" in pause and "state.activityRun=null" not in pause)
    check("workflow: finish routes through normal classroom return", "returnToClassroom('normal')" in finish)
    check("workflow: normal return clears activityRun", "state.activityRun=null" in returned)
    check("workflow: emergency return remains distinct", "returnToClassroom('emergency')" in html)
    check("workflow: explicit Pause & Keep Progress UI remains", "Pause & Keep Progress" in html)
    check("workflow: explicit Finish & Return UI remains", "Finish & Return" in html)

    # v50.7 completed-session persistence boundary.
    end_start = html.find("$('#endBtn').onclick")
    end_segment = html[end_start:end_start + 1400] if end_start >= 0 else ""
    check("history: completed session persisted from End Session", "teacherSummaryFinalizeSession()" in end_segment and "persistCompletedTeacherSession()" in end_segment)
    normalize = segment(html, "function normalizeTeacherHistorySnapshot(")
    check("history: normalized records omit raw photo/help payload fields", ".data" not in normalize and "text:" not in normalize and ".text" not in normalize)

    # Sketch Signal critical invariants.
    board_css = re.search(r"\.board-surface\s*\{([^}]*)\}", html, re.S)
    check("sketch: board surface remains 4:3", bool(board_css and re.search(r"aspect-ratio\s*:\s*4\s*/\s*3", board_css.group(1))))
    check("sketch: shared live-ink patch path remains", "function canPatchSketchSharedSync(" in html and "function patchSketchSharedInk(" in html)
    check("sketch: live patch targets shared sketch SVG", "document.querySelectorAll('.sketch-public .board-surface svg')" in html)
    check("sketch: scoring hooks remain", "sketchScores" in html and "_sketch_award_score" in server)

    # STARWHEEL authority/privacy invariants.
    sw_server = segment(server, "def _starwheel_apply_request(")
    check("starwheel: server validates active pilot", "_starwheel_active_pilot_name(state, run) != name" in sw_server)
    check("starwheel: server owns random spin", "secrets.randbelow" in sw_server and 'action == "spin"' in sw_server)
    check("starwheel: server owns scoring updates", "_starwheel_adjust_score" in sw_server)
    check("starwheel: private solve review remains", 'sw["pendingSolve"]' in sw_server and "solve_pending" in sw_server)
    role_filter = segment(server, "def _state_for_role(")
    check("starwheel: answer hidden from student role", 'cfg.pop("answer", None)' in role_filter)
    check("starwheel: pending solve hidden from non-teacher state", 'sw.pop("pendingSolve", None)' in role_filter)
    check("starwheel: puzzle-pack persistence remains", "siMothership.starwheelPuzzlePacks.v1" in persisted_keys)
    check("starwheel: special sectors and Final Signal remain", "STARWHEEL_SPECIALS" in html and "finalSignal" in html)

    # Existing teacher persistence and runtime basics.
    check("persistence: presets and recents remain present", {"siMothership.activityPresets.v1", "siMothership.recentActivities.v1"} <= persisted_keys)
    check("server: /api/health remains configured", "/api/health" in server)

    print(f"\nRelease gate: {len(passes)} passed, {len(failures)} failed.")
    if failures:
        print("Failed checks:")
        for name in failures:
            print(f" - {name}")
        return 1
    print("READY FOR DEPLOYMENT")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
