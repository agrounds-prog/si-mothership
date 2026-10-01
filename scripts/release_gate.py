#!/usr/bin/env python3
"""SI Mothership release regression gate.

Run:
  python scripts/release_gate.py
  python scripts/release_gate.py --require-node

The stricter form is used in CI and validates the inline JavaScript with Node.
"""
from __future__ import annotations

import argparse
import gzip
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SERVER = ROOT / "server.py"
CALCULATOR_DIR = ROOT / "scientific-calculator"
CALCULATOR_INDEX_GZ = CALCULATOR_DIR / "index.html.gz"
CALCULATOR_ENGINE_GZ = CALCULATOR_DIR / "engine.js.gz"
CALCULATOR_TEST_GZ = CALCULATOR_DIR / "engine.test.js.gz"

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

    # HTML shell integrity: release styles must not split structural tags.
    head_close = html.find("</head>")
    body_open = html.find("<body", head_close)
    release_styles = (
        '<style id="v52-1-teacher-mission-control">',
        '<style id="v52-2-student-ui">',
        '<style id="v53-1-classroom-calculator">',
        '<style id="v53-3-whiteboard-calculator">',
        '<style id="v53-4-board-calculator-mirror">',
        '<style id="v53-5-shared-projector-layout">',
        '<style id="v53-6-calculator-classroom-modeling-mirror">',
        '<style id="v53-7-high-fidelity-calculator-mirror">',
        '<style id="v53-9-roster-signal-refresh">',
    )
    check("html shell: head closes before body opens", head_close >= 0 and body_open > head_close and bool(re.search(r"</head>\s*<body(?:\s|>)", html, re.I)))
    check("html shell: release styles are inside head", head_close >= 0 and all(0 <= html.find(tag) < head_close for tag in release_styles))
    check("html shell: no split structural tag corruption", all(token not in html for token in ("</styl\n<style", "</style>e>", "<b\n<style", "</style>ody>")))

    # v53.3 BOARD calculator overlay: teacher-local and outside synchronized state.
    check("board calculator: toolbar launch remains", 'id="boardCalculatorBtn"' in html and "ƒx Calculator" in html)
    check("board calculator: floating overlay remains", 'id="boardCalculatorOverlay"' in html and 'id="boardCalculatorFrame"' in html and "BOARD TOOL · TEACHER ONLY" in html)
    check("board calculator: reuses SI calculator route", "function boardCalculatorSrc()" in html and "scientificCalculatorUrl()" in segment(html, "function boardCalculatorSrc()"))
    check("board calculator: teacher-local open state", "let boardCalculatorOpen=false" in html and "state.boardCalculatorOpen" not in html)
    check("board calculator: render preserves overlay lifecycle", "syncBoardCalculatorOverlay();publishSyncedState()" in html)
    check("board calculator: whiteboard drawing flow remains", "wireBoardSurface(document.querySelector('[data-board-surface=\"teacher\"]'),'teacher')" in html)

    # v53.4 shared BOARD calculator mirror.
    check("board calculator mirror: shared markup remains", "function boardCalculatorMirrorMarkup(" in html and "boardCalculatorMirrorMarkup(run)" in html)
    check("board calculator mirror: compact read-only shell remains", "board-calculator-mirror-lcd" in html and "board-calculator-mirror-keys" in html and "Teacher calculator mirror" in html)
    check("board calculator mirror: teacher iframe snapshot bridge remains", "function boardCalculatorDisplaySnapshot()" in html and "MutationObserver" in segment(html, "function wireBoardCalculatorMirrorFrame("))
    check("board calculator mirror: only public display snapshot is synced", "run.boardCalculatorMirror=next;" in html and all(x in segment(html, "function publishBoardCalculatorMirror(") for x in ("lines:","angle:","format:","updatedAt:")) and "history:" not in segment(html, "function publishBoardCalculatorMirror(") and "memory:" not in segment(html, "function publishBoardCalculatorMirror("))
    check("board calculator mirror: student BOARD stays controls-only", "boardCalculatorMirrorMarkup" not in segment(html, "function studentMarkup("))
    check("board calculator mirror: close removes shared mirror", "state.activityRun.boardCalculatorMirror=null" in segment(html, "function setBoardCalculatorOpen("))

    # v53.5 dedicated Shared Screen projector layout.
    projector_style = re.search(r'<style id="v53-5-shared-projector-layout">(.*?)</style>', html, re.S)
    projector_css = projector_style.group(1) if projector_style else ""
    check("shared projector: release style remains", bool(projector_style))
    check("shared projector: widescreen side HUD remains", "grid-template-columns:clamp(132px,10.5vw,176px) minmax(0,1fr)" in projector_css and "grid-row:1 / 3" in projector_css)
    check("shared projector: BOARD uses full public height", "body.role-shared .board-public-wrap" in projector_css and "height:100%" in projector_css and "body.role-shared .board-shared-stage" in projector_css)
    check("shared projector: BOARD metadata floats over canvas", "body.role-shared .board-public-head" in projector_css and "position:absolute" in projector_css)
    check("shared projector: narrow-screen fallback remains", "@media(max-width:900px),(max-aspect-ratio:4/3)" in projector_css)

    # v53.6 classroom-modeling calculator visual refresh.
    check("calculator modeling: server decompresses packaged calculator for visual skin", "import gzip" in server and "gzip.decompress(CALCULATOR_INDEX_GZ.read_bytes())" in server)
    check("calculator modeling: dedicated SI visual skin remains", 'id="v53-6-calculator-classroom-modeling"' in server and 'si-model-calculator' in server and 'si-model-lcd' in server)
    check("calculator modeling: key grouping script remains", 'id="v53-6-calculator-classroom-modeling-script"' in server and "key.dataset.modelGroup=group" in server and "document.querySelectorAll('[data-action]')" in server)
    check("calculator modeling: physical key hierarchy remains", 'data-model-group="number"' in server and 'data-model-group="operator"' in server and 'data-action="second"' in server)
    check("calculator modeling: SI branding boundary remains", "Classroom Modeling Calculator" in server and "Texas Instruments" not in server and "TI-30XS" not in server)
    check("calculator modeling: shared BOARD mirror matches visual family", '<style id="v53-6-calculator-classroom-modeling-mirror">' in html and "SI SCIENTIFIC" in html and "MULTI-VIEW · 4-LINE" in html)
    check("calculator modeling: calculator engine asset remains separate", "CALCULATOR_ENGINE_GZ.read_bytes()" in server and 'Content-Encoding": "gzip"' in segment(server, "async def scientific_calculator_engine("))
    check("calculator modeling: BOARD mirror privacy boundary remains", "run.boardCalculatorMirror=next;" in html and "history:" not in segment(html, "function publishBoardCalculatorMirror(") and "memory:" not in segment(html, "function publishBoardCalculatorMirror("))

    # v53.7 high-fidelity classroom calculator modeling refresh.
    check("calculator hifi: dedicated reference-inspired skin remains", 'id="v53-7-high-fidelity-calculator-modeling"' in server and 'si-hifi-model' in server)
    check("calculator hifi: light outer rails and teal faceplate remain", '#cfd5d7 0 7.5%' in server and '#315a69 7.5% 92.5%' in server)
    check("calculator hifi: compact LCD treatment remains", 'body.si-classroom-model.si-hifi-model .si-model-lcd' in server and 'min-height:104px' in server)
    check("calculator hifi: oval navigation cluster remains", 'si-model-navpad' in server and 'nav.innerHTML' in server and '▲' in server and '▶' in server)
    check("calculator hifi: physical key hierarchy remains", 'data-model-group="number"' in server and 'data-model-group="operator"' in server and 'data-action="second"' in server)
    check("calculator hifi: SI-only branding remains", 'SI CLASSROOM SCIENTIFIC' in server and 'Texas Instruments' not in server and 'TI-30XS' not in server)
    check("calculator hifi: shared mirror visual family remains", '<style id="v53-7-high-fidelity-calculator-mirror">' in html and 'MULTI-VIEW · 4-LINE' in html and 'board-calculator-mirror-nav' in html)
    check("calculator hifi: shared mirror stays read-only", 'pointer-events:none' in segment(html, '<style id="v53-4-board-calculator-mirror">', next_markers=('</style>',)) or 'pointer-events:none' in segment(html, '<style id="v53-7-high-fidelity-calculator-mirror">', next_markers=('</style>',)))
    check("calculator hifi: engine and privacy boundaries remain", 'CALCULATOR_ENGINE_GZ.read_bytes()' in server and 'run.boardCalculatorMirror=next;' in html and 'history:' not in segment(html, "function publishBoardCalculatorMirror(") and 'memory:' not in segment(html, "function publishBoardCalculatorMirror("))

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

    # v53.0 standalone SI Scientific Calculator.
    calc_files = (CALCULATOR_INDEX_GZ, CALCULATOR_ENGINE_GZ, CALCULATOR_TEST_GZ)
    calc_files_present = all(p.exists() for p in calc_files)
    check("calculator: packaged source assets exist", calc_files_present)
    calc_html = calc_engine = calc_test = ""
    if calc_files_present:
        try:
            calc_html = gzip.decompress(CALCULATOR_INDEX_GZ.read_bytes()).decode("utf-8")
            calc_engine = gzip.decompress(CALCULATOR_ENGINE_GZ.read_bytes()).decode("utf-8")
            calc_test = gzip.decompress(CALCULATOR_TEST_GZ.read_bytes()).decode("utf-8")
            check("calculator: packaged source assets decompress", True)
        except Exception as exc:
            check("calculator: packaged source assets decompress", False, str(exc))
    check("calculator: standalone route remains configured", "/tools/scientific-calculator" in server and "scientific_calculator_engine" in server)
    check("calculator: four-line familiar UI remains", all(x in calc_html for x in ('class="lcd"', 'data-action="second"', 'data-action="fraction"', 'data-action="enter"', 'class="key operator"')))
    check("calculator: SI branding/IP boundary remains", "SI Scientific Calculator" in calc_html and "TI-30XS" not in calc_html)
    check("calculator: expression engine does not use eval", not re.search(r"\beval\s*\(", calc_engine) and "new Function(" not in calc_engine)

    if node and calc_files_present:
        calc_parse_ok = True
        calc_parse_detail = ""
        calc_scripts = re.findall(r"<script[^>]*>(.*?)</script>", calc_html, flags=re.S | re.I)
        for i, script in enumerate(calc_scripts, 1):
            if not script.strip():
                continue
            p = subprocess.run(
                [node, "-e", "new Function(require('fs').readFileSync(0,'utf8'))"],
                input=script,
                text=True,
                capture_output=True,
            )
            if p.returncode:
                calc_parse_ok = False
                calc_parse_detail = f"calculator script {i}: {p.stderr.strip()[:500]}"
                break
        check("calculator: inline app script parses", calc_parse_ok, calc_parse_detail)
        with tempfile.TemporaryDirectory() as td:
            tdir = Path(td)
            (tdir / "engine.js").write_text(calc_engine, encoding="utf-8")
            (tdir / "engine.test.js").write_text(calc_test, encoding="utf-8")
            p = subprocess.run([node, "engine.test.js"], cwd=td, text=True, capture_output=True)
            check("calculator: engine acceptance tests pass", p.returncode == 0, (p.stderr or p.stdout)[-600:])
    else:
        check("calculator: engine acceptance tests pass", not args.require_node, "Node is required for calculator tests")


    # v53.1 classroom calculator integration.
    check("calculator classroom: tool registered in Activity Library", "id:'scientific-calculator'" in html and "CLASSROOM TOOL" in html)
    check("calculator classroom: teacher actions remain present", all(x in html for x in ("Open Calculator", "Launch for Class", "Copy Share Link", "Show QR Code", "End for Class")))
    check("calculator classroom: launch payload is settings-only", "calculatorLaunch={id:'calc_'" in html and "settings:deepClone(settings)" in html and "calculatorLaunch.history" not in html and "calculatorLaunch.expression" not in html)
    check("calculator classroom: student panel and return control remain", "student-calculator-frame" in html and "Back to Classroom" in html and "studentCalculatorDismissedLaunchId" in html)
    check("calculator classroom: calculator runs in existing standalone route", "/tools/scientific-calculator" in html and "scientificCalculatorUrl" in html)
    check("calculator classroom: normal activity launch closes calculator", "if(state.calculatorLaunch)state.calculatorLaunch=null;" in segment(html, "function recordActivityLaunch("))

    # Historical selector invariant: $() is single-element; $() is multi-element.
    bad_selector_lines = []
    for number, line in enumerate(html.splitlines(), 1):
        stripped = line.replace("$$(", "__MULTI__(")
        if re.search(r"\$\([^;\n]*\)\.forEach\s*\(", stripped):
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
    check("starwheel: dedicated action transport remains", "starwheel_action" in html and 'mtype == "starwheel_action"' in server)
    check("starwheel: active pilot main card exposes spin", "data-starwheel-spin" in html and "SPIN STARWHEEL" in html)
    check("starwheel: consonant grid remains student-selectable", "data-starwheel-letter" in html and "STARWHEEL_CONSONANTS.map" in html)
    check("starwheel: numeric spin enters consonant stage", 'sw["stage"] = "letter"' in sw_server and "Choose a consonant" in sw_server)
    check("starwheel: consonant selection returns to ready", 'if action == "letter"' in sw_server and 'sw["stage"] = "ready"' in sw_server)
    check("starwheel: consonants exclude vowels and repeats", "value not in STARWHEEL_CONSONANTS or value in used" in sw_server)
    check("starwheel: vowels are accepted only from ready", 'if action == "vowel"' in sw_server and 'str(sw.get("stage") or "ready") != "ready"' in sw_server)
    check("starwheel: correct letters preserve control and misses rotate", "_starwheel_advance(state, run, occurrences > 0)" in sw_server)
    check("starwheel: wheel landing uses relative delta", "current_mod = current_deg % 360.0" in sw_server and "delta = (target - current_mod) % 360.0" in sw_server)
    check("starwheel: server preserves previous wheel angle", 'sw["spinFromDeg"] = current_deg' in sw_server)
    check("starwheel: browser animates once per spin nonce", "function animateStarwheelWheels()" in html and "nonce!==starwheelLastAnimatedNonce" in html)
    check("starwheel: browser animates previous to final angle", "shouldAnimate?from:target" in html and "rotate(${target}deg)" in html)
    check("starwheel: selected sector is explicitly marked", "data-spin-index" in html and "data-sector-index" in html and "'landed'" in html)
    check("starwheel: student stage instructions remain explicit", "YOUR TURN · SPIN OR BUY A VOWEL" in html and "SPIN COMPLETE · CHOOSE A CONSONANT" in html)
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
