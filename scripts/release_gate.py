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
        '<style id="v54-0-student-experience-overhaul">',
        '<style id="v54-1-visual-refinement-system">',
        '<style id="v54-2-roster-visual-detail">',
        '<style id="v55-0-game-show-pack">',
        '<style id="v55-1-roster-refinement">',
        '<style id="v55-2-game-show-visual-refinement">',
        '<style id="v55-3-shortcut-manager">',
        '<style id="v55-4-classroom-workflow-polish">',
        '<style id="v55-5-activity-library-organization">',
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

    # v54.2 roster visual detail pass.
    check("roster detail: avatar-stage wrapper remains", 'class="crew-avatar-stage"' in html)
    check("roster detail: live chips stay inside avatar stage", 'crew-avatar-stage' in segment(html, 'function renderRoster(){') and 'buzz-chip' in segment(html, 'function renderRoster(){') and 'hand-chip' in segment(html, 'function renderRoster(){') and 'help-chip' in segment(html, 'function renderRoster(){'))
    check("roster detail: duplicate prompt response suppression remains", "showResponseNote=!!resp" in html and "['ready','emotion','understanding']" in html)
    check("roster detail: sparse pod layout remains", "repeat(auto-fit,minmax(230px,280px))" in html and "#teacher .roster-card.sparse-roster .crew{" in html)

    # v55.0 GAME SHOW PACK — CREW SURVEY + MILLION.
    check("game shows: app registry contains both games", "id:'crew-survey',name:'CREW SURVEY'" in html and "id:'million',name:'MILLION'" in html)
    check("game shows: activity seeds contain both runtimes", "id:'crew-survey-game'" in html and "id:'million-game'" in html)
    check("game shows: teacher setup flows remain", "state.activeApp==='crew-survey'" in html and "state.activeApp==='million'" in html and "launchCrewSurvey" in html and "launchMillion" in html)
    check("game shows: shared stages remain", "function crewSurveySharedMarkup(" in html and "function millionSharedMarkup(" in html)
    check("game shows: student controllers remain", "function crewSurveyStudentMarkup(" in html and "function millionStudentMarkup(" in html and "wireCrewSurveyStudent" in html and "wireMillionStudent" in html)
    check("game shows: dedicated action transport is server-authoritative", "game_show_action" in html and 'mtype == "game_show_action"' in server)

    crew_server = segment(server, "def _crew_survey_apply_request(")
    check("crew survey: buzzer validates armed and eligible", 'action == "buzz"' in crew_server and 'not buzzer.get("armed")' in crew_server and "name not in eligible" in crew_server)
    check("crew survey: first buzz atomically closes buzzer", 'buzzer["winner"] = name' in crew_server and 'buzzer["armed"] = False' in crew_server)
    check("crew survey: private answers require winner/current player", 'action == "answer"' in crew_server and "_crew_survey_active_name(run, team) == name" in crew_server)
    check("crew survey: private response is sanitized", '[:160]' in crew_server and 'source not in {"aac", "type"}' in crew_server)

    million_server = segment(server, "def _million_apply_request(")
    check("million: server validates pilot-only command actions", 'str(million.get("pilot") or "") != name' in million_server and 'action == "select"' in million_server and 'action == "lock"' in million_server)
    check("million: play-along predictions are server merged", 'action == "predict"' in million_server and 'predictions[name] = key' in million_server)
    check("million: server owns student lifeline mutations", 'lifeline not in {"poll", "reduce", "clue", "tryAgain"}' in million_server and 'inventory[lifeline] = remaining - 1' in million_server)
    check("million: reduce signal never exposes answer key through client request", 'correct = str(question.get("correct")' in million_server and 'million["eliminated"] = wrong[:2]' in million_server)

    role_filter = segment(server, "def _state_for_role(")
    check("crew survey privacy: hidden answer text and values are masked", 'clean["text"] = ""' in role_filter and 'clean["value"] = 0' in role_filter)
    check("crew survey privacy: private answers do not reach shared screen", 'cs["privateResponses"] = {}' in role_filter and 'cs.pop("lastResponse", None)' in role_filter)
    check("crew survey privacy: student sees only own private response", '{own_name: copy.deepcopy(private_responses[own_name])}' in role_filter)
    check("million privacy: current question strips answer key and clue source", 'clean.pop("correct", None)' in role_filter and 'clean.pop("mothershipClue", None)' in role_filter and 'clean.pop("explanation", None)' in role_filter)
    check("million privacy: future questions are hidden", 'safe_questions.append({"prompt": "", "choices": []})' in role_filter)
    check("million privacy: play-along predictions are role-filtered", 'million["crewPredictions"] = {}' in role_filter and '{own_name: copy.deepcopy(predictions[own_name])}' in role_filter)
    check("million privacy: shared/nonpilot selected answer is hidden", 'million["selectedAnswer"] = ""' in role_filter)
    check("million privacy: shared poll exposes aggregates without identities", 'million["publicPollCounts"] = poll_counts' in role_filter and 'million["crewPredictions"] = {}' in role_filter and "publicPollCounts" in html)

    try:
        compile(server, str(SERVER), "exec")
        server_syntax_ok, server_syntax_detail = True, ""
    except SyntaxError as exc:
        server_syntax_ok, server_syntax_detail = False, f"{exc.msg} at line {exc.lineno}"
    check("server: Python source parses", server_syntax_ok, server_syntax_detail)

    # v55.1 sparse roster refinement.
    check("roster refinement: release style remains", '<style id="v55-1-roster-refinement">' in html)
    check("roster refinement: one/two student hero layout remains", 'avatar-line:not(:has(.crew:nth-child(3)))' in html and 'grid-template-columns:188px minmax(165px,1fr)' in html)
    check("roster refinement: active alert rails remain", 'crew.buzz-glow::before' in html and 'crew.hand-raised-glow::after' in html)
    check("roster refinement: connected-state dot remains", 'crew>small::before' in html and 'background:#65d2a5' in html)

    # v55.2 game-show visual refinement.
    check("game show visual refinement: release style remains", '<style id="v55-2-game-show-visual-refinement">' in html)
    check("crew survey refinement: stage framing remains", '.crew-survey-public::before' in html and '.crew-survey-public::after' in html and 'content:"SURVEY BOARD"' in html)
    check("crew survey refinement: tactile student buzzer remains", 'body.role-student .crew-survey-big-buzz::after' in html and 'radial-gradient(circle at 42% 30%' in html)
    check("million refinement: stage framing remains", '.million-public::before' in html and '.million-public::after' in html and '.million-choice.locked' in html)
    check("million refinement: command seat emphasis remains", 'body.role-student .million-student.command-seat' in html and 'body.role-student #millionLockBtn:not(:disabled)' in html)

    # v55.3 editable Activity Shortcuts.
    check("shortcut manager: release style remains", '<style id="v55-3-shortcut-manager">' in html)
    check("shortcut manager: remove and replace helpers remain", 'function removeAppShortcut(' in html and 'function beginShortcutAssignment(' in html)
    check("shortcut manager: activities surface exposes all slot controls", 'data-shortcut-replace=' in html and 'data-shortcut-remove=' in html and 'shortcut-manage-card' in html)
    check("shortcut manager: assignment replaces occupied slot", 'state.favoriteSlots[slot]=id' in html and 'previous!==slot' in html)
    check("shortcut manager: changes persist locally", 'persistAppShortcuts()' in segment(html, 'function removeAppShortcut(') and 'persistAppShortcuts()' in segment(html, "$('[data-assign-app]"))

    # v55.4 classroom workflow hardening + sparse roster signal dock.
    roster_segment = segment(html, "function renderRoster(")
    remove_shortcut_segment = segment(html, "function removeAppShortcut(")
    check("classroom QA: roster derives help, hand, and buzz independently", all(x in roster_segment for x in ("help=(state.helpMessages", "hand=state.alerts.some", "buzzIndex=state.buzz.indexOf")))
    check("classroom QA: first-buzzer ordering remains visible", "buzzIndex===0?'buzz-first'" in roster_segment and "BUZZ ${buzzIndex+1}" in roster_segment)
    check("classroom QA: sparse roster uses integrated signal dock", "crew-signal-dock" in roster_segment and "sparseSignals=state.students.length<=4" in roster_segment)
    check("classroom QA: shortcut removal only clears the shortcut slot", "state.favoriteSlots[i]=null" in remove_shortcut_segment and "persistAppShortcuts()" in remove_shortcut_segment and "state.activities" not in remove_shortcut_segment)
    check("classroom QA: shortcut replacement keeps duplicate-slot cleanup", "previous>=0&&previous!==slot" in html and "state.favoriteSlots[previous]=null" in html and "state.favoriteSlots[slot]=id" in html)
    check("classroom polish: release style remains", '<style id="v55-4-classroom-workflow-polish">' in html)
    check("classroom polish: integrated buzz hand help styles remain", all(x in html for x in ('.crew-signal-dock .buzz-chip', '.crew-signal-dock .hand-chip', '.crew-signal-dock .help-chip')))

    # v55.5 searchable, categorized Activity Library.
    library_render = segment(html, "function renderActivities(")
    check("activity library: release style remains", '<style id="v55-5-activity-library-organization">' in html)
    check("activity library: search remains teacher-local", "let activityLibraryQuery=''" in html and "activityLibraryQuery" not in segment(html, "function sharedStateSnapshot("))
    check("activity library: category filters remain", all(x in html for x in ("ACTIVITY_LIBRARY_CATEGORY_ORDER", "'presentation'", "'collaboration'", "'games'", "'tools'")))
    check("activity library: every registered app category is represented", all(x in html for x in ("id==='si-plus'", "['vector','board','orbit']", "['minefield','sketch','pixel','starwheel','crew-survey','million']", "id==='scientific-calculator'")))
    check("activity library: recent shelf precedes saved presets", "activity-library-shelves" in library_render and "recentSection" in library_render and "presetSection" in library_render and "recentSection}${presetSection}" in library_render)
    check("activity library: catalog filters before rendering", "const visibleApps=APP_REGISTRY.filter(app=>activityLibraryMatches(app))" in library_render and "Showing ${visibleApps.length} of ${APP_REGISTRY.length}" in library_render)
    check("activity library: shortcut management remains available", all(x in library_render for x in ("data-shortcut-replace", "data-shortcut-remove", "data-manage-shortcut", "data-add-app")))

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

    # v55.12 stable calculator overlay window for screen-sharing/modeling.
    check("calculator popup: teacher launcher requests stationary popup", "scientificCalculatorPopupUrl" in html and "popup=yes,width=280,height=700" in html and "siScientificCalculator" in html)
    check("calculator popup: class launch also opens teacher modeling window", "openScientificCalculator(settings)" in segment(html, "function launchScientificCalculatorForClass("))
    check("calculator popup: route injects popup skin only when requested", 'request.query.get("popup")' in server and "CALCULATOR_POPUP_STYLE if popup_mode else" in server)
    check("calculator popup: calculator is pinned to browser content origin", "display:block!important" in server and "width:0!important" in server and "padding:0!important" in server and "margin:0!important" in server)
    check("calculator popup: normal physical calculator proportions remain", "width:332px!important" in server and "min-height:104px!important" in server and "min-height:34px!important" in server)
    check("calculator bare popup: release style remains", 'id="v55-8-calculator-bare-popup"' in server)
    check("calculator bare popup: tool-page chrome is removed from popup body", "function isolateCalculator()" in server and "document.body.appendChild(calc)" in server and "if(child!==calc)child.hidden=true" in server)
    check("calculator stable popup: window never resizes itself", "window.resizeBy" not in server and "window.resizeTo" not in server)
    check("calculator stable popup: no layout observer feedback loop", "ResizeObserver" not in segment(server, 'id="v55-6-calculator-popup-window-script"') and "MutationObserver" not in segment(server, 'id="v55-6-calculator-popup-window-script"'))
    check("calculator stable popup: preferred device scale is compact", "const preferredScale=.68" in server and "--si-popup-scale,.68" in server)
    check("calculator stable popup: full visible descendants determine fit", "function visualBounds(calc)" in server and "calc.querySelectorAll('*')" in server and "bottom=Math.max(bottom,r.bottom)" in server)
    check("calculator stable popup: calculator scales to current viewport", "window.innerWidth-4" in server and "window.innerHeight-4" in server and "preferredScale*ratio*.985" in server)
    check("calculator stable popup: manual teacher resize only rescales content", "window.addEventListener('resize',fitCalculatorInsideWindow)" in server)
    check("calculator stable popup: launch stays near screen origin", "left=8,top=8" in html)

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
