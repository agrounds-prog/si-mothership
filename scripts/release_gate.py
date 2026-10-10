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
    title_version = re.search(r"<title>[^<]*v(\d+\.\d+(?:\.\d+)?)", html)
    server_version = re.search(r'APP_VERSION\s*=\s*"([^"]+)"', server)
    check("version: title and server match", bool(title_version and server_version and title_version.group(1) == server_version.group(1)))


    # v56.9.3 canonical Classroom controls live directly in index.html.
    canonical_style = re.search(r'<style id="v56-9-3-canonical-classroom-controls">(.*?)</style>', html, re.S)
    canonical_controls = canonical_style.group(1) if canonical_style else ""
    check("canonical controls v56.9.3: source style remains", bool(canonical_controls))
    check("canonical controls v56.9.3: runtime patch injection is gone", 'CONTROL_ART_CENTERING_STYLE + CONTROL_ART_REPAIR_SCRIPT' not in server)
    check("canonical controls v56.9.3: End Session is in the standard control row", '<button class="control" id="endBtn">' in html)
    check("canonical controls v56.9.3: End Session no longer uses legacy end classes", 'id="endBtn"' in html and 'class="end-btn v562-end-btn" id="endBtn"' not in html)
    check("canonical controls v56.9.3: standard launcher footprint is 72x86", "width:72px!important" in canonical_controls and "height:86px!important" in canonical_controls)
    check("canonical controls v56.9.3: standard art footprint is 64px", "width:64px!important" in canonical_controls and "height:64px!important" in canonical_controls and "flex:0 0 64px!important" in canonical_controls)
    check("canonical controls v56.9.3: End Session inherits standard control geometry", "#teacher #endBtn{" in canonical_controls and "#teacher #endBtn .ico.v562-art{" in canonical_controls)
    check("canonical controls v56.9.3: legacy danger slot collapses when unused", "#teacher .single-mission-danger:has(#emergencyReturnBtn.hidden)" in canonical_controls)
    check("canonical controls v56.9.3: Activity Shortcut inner frame padding is removed", "#teacher .app-shortcut-icon{" in canonical_controls and "padding:0!important" in canonical_controls and "#teacher .app-shortcut-icon:after" in canonical_controls)

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
    check("activity library: every registered app category is represented", all(x in html for x in ("id==='si-plus'", "['vector','board','orbit']", "['minefield','sketch','pixel','starwheel','crew-survey','million','match','bingo','cosmic-cards']", "id==='scientific-calculator'")))
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
    check("calculator popup: teacher launcher requests stationary popup", "scientificCalculatorPopupUrl" in html and "popup=yes,width=340,height=650" in html and "siScientificCalculator" in html)
    check("calculator popup: class launch also opens teacher modeling window", "openScientificCalculator(settings)" in segment(html, "function launchScientificCalculatorForClass("))
    check("calculator popup: route injects popup skin only when requested", 'request.query.get("popup")' in server and "CALCULATOR_POPUP_STYLE if popup_mode else" in server)
    check("calculator popup: calculator is pinned to browser content origin", "display:block!important" in server and "width:0!important" in server and "padding:0!important" in server and "margin:0!important" in server)
    check("calculator popup: normal physical calculator proportions remain", "width:286px!important" in server and "min-height:80px!important" in server and "grid-template-rows:22px 22px 25px 25px 25px 26px!important" in server)
    check("calculator bare popup: release style remains", 'id="v55-8-calculator-bare-popup"' in server)
    check("calculator bare popup: tool-page chrome is removed from popup body", "function isolateCalculator()" in server and "document.body.appendChild(calc)" in server and "if(child!==calc)child.hidden=true" in server)
    check("calculator stable popup: window never resizes itself", "window.resizeBy" not in server and "window.resizeTo" not in server)
    check("calculator stable popup: no layout observer feedback loop", "ResizeObserver" not in segment(server, 'id="v55-6-calculator-popup-window-script"') and "MutationObserver" not in segment(server, 'id="v55-6-calculator-popup-window-script"'))
    check("calculator stable popup: preferred device scale is compact", "const preferredScale=.82" in server and "--si-popup-scale,.88" in server)
    check("calculator stable popup: full visible descendants determine fit", "function visualBounds(calc)" in server and "calc.querySelectorAll('*')" in server and "bottom=Math.max(bottom,r.bottom)" in server)
    check("calculator stable popup: calculator scales to current viewport", "window.innerWidth-4" in server and "window.innerHeight-4" in server and "preferredScale*ratio*.975" in server)
    check("calculator stable popup: manual teacher resize only rescales content", "window.addEventListener('resize',fitCalculatorInsideWindow)" in server)
    check("calculator stable popup: launch stays near screen origin", "left=8,top=8" in html)
    check("calculator readable popup: compact overlay window remains", "popup=yes,width=340,height=650" in html)
    check("calculator readable popup: preferred scale remains whole-device bounded", "const preferredScale=.82" in server and "--si-popup-scale,.88" in server)
    check("calculator readable popup: LCD text gets slight popup-only boost", ".si-model-lcd *{" in server and "font-size:1.05em!important" in server)
    check("calculator reference layout: release style remains", 'id="v55-14-reference-calculator-layout"' in server)
    check("calculator reference layout: top deck is three controls plus nav", "si-ref-control-deck" in server and "grid-template-columns:repeat(3,minmax(0,1fr)) 31px 31px" in server and "top=[second,mode,del]" in server)
    check("calculator reference layout: clear is secondary legend not a fourth top key", "si-ref-clear-legend" in server and "clear.hidden=true" in server and "clear.click()" in server)
    check("calculator reference layout: remaining keypad is five columns", "grid-template-columns:repeat(5,minmax(0,1fr))!important" in server and "data-ref-matrix-count" not in server)
    check("calculator reference layout: silver rails and teal center remain", "#e0e3e4 0 8%" in server and "#3b6675 10.2% 89.8%" in server)
    check("calculator reference layout: solar panel and SI maker line remain", "si-ref-solar" in server and "SI MOTHERSHIP" in server)
    check("calculator reference layout: number and operator hierarchy remain", "#f5f4f1" in server and "#716a73" in server and "data-model-group=\"number\"" in server)
    check("calculator physical layout: release style remains", 'id="v55-15-physical-calculator-layout"' in server and 'id="v55-15-physical-calculator-layout-script"' in server)
    check("calculator physical layout: explicit seven-by-five key map remains", "const slots=[" in server and "for(let r=0;r<7;r++)" in server and "for(let c=0;c<5;c++)" in server)
    check("calculator physical layout: number block is pinned to reference rows", "/* 7 8 9 */" in server and "/* 4 5 6 */" in server and "/* 1 2 3 */" in server and "key=digit(0)" in server)
    check("calculator physical layout: arithmetic column is explicit", all(x in server for x in ("/divide|÷/", "/multiply|×|\\*/", "/subtract|minus|−/", "/\\badd\\b|plus|\\+/")))
    check("calculator physical layout: function rows are identity-mapped", all(x in server for x in ("/\\blog\\b/", "/\\bln\\b|natural.?log/", "/\\bsin\\b/", "/\\bcos\\b/", "/\\btan\\b/", "/reciprocal|1\\s*\\/\\s*x/")))
    check("calculator physical layout: green second key and circular nav remain", "#b8df64" in server and "border-radius:50%!important" in server and "si-model-navpad" in server)
    check("calculator physical layout: matrix placement is explicit", "key.style.gridRow=String(r+1)" in server and "key.style.gridColumn=String(c+1)" in server and "refPhysicalMapped='1'" in server)
    check("calculator visual fidelity: release style remains", 'id="v55-16-calculator-visual-fidelity"' in server)
    check("calculator visual fidelity: tapered shell and silver rails remain", "clip-path:polygon(7% 0,93% 0" in server and "#eef0ef 0 6.8%" in server and "#416b79 9.1% 90.9%" in server)
    check("calculator visual fidelity: physical LCD height tracks final reference", "min-height:80px!important;height:80px!important" in server and "min-height:104px!important" not in segment(server, 'id="v55-6-calculator-popup-window"'))
    check("calculator visual fidelity: popup does not inflate mapped key height", ".si-model-key{min-height:0!important}" in server)
    check("calculator visual fidelity: nav has bright reference bezel", "outline:6px solid #eef0ef!important" in server and "width:54px!important" in server and "height:40px!important" in server)
    check("calculator visual fidelity: function and numeric key shapes differ", "grid-template-rows:22px 22px 22px 25px 25px 25px 25px!important" in server and "border-radius:999px!important" in server and "border-radius:7px 5px 7px 5px!important" in server)
    check("calculator visual fidelity: secondary legends float above keys", "top:-6px!important" in server and "color:#b8d75f!important" in server)
    check("calculator reference accurate: release style and script remain", 'id="v55-17-reference-calculator-layout"' in server and 'id="v55-17-reference-calculator-layout-script"' in server)
    check("calculator reference accurate: upper face is three rows by five columns", "grid-template-rows:22px 22px 22px!important" in server and "grid-template-columns:repeat(5,minmax(0,1fr))!important" in segment(server, 'id="v55-17-reference-calculator-layout"'))
    check("calculator reference accurate: nav spans upper two rows", "nav.style.gridRow='1 / span 2'" in server and "nav.style.gridColumn='4 / span 2'" in server)
    check("calculator reference accurate: physical log-prb-data positions remain", "place(log,deck,2,1)" in server and "placeholder('prb',2,2)" in server and "placeholder('data',2,3)" in server)
    check("calculator reference accurate: lower keypad is six by five", "grid-template-rows:22px 22px 25px 25px 25px 26px!important" in server and "rows.forEach(function(rowKeys,r)" in server)
    check("calculator polish: release style remains", 'id="v55-18-calculator-reference-polish"' in server)
    check("calculator polish: shell keeps stronger silver rails", "#f7f8f7 0 5.2%" in server and "#c5cbcc 7.7% 9.2%" in server)
    check("calculator polish: shell silhouette remains tapered", "clip-path:polygon(7.5% 0,92.5% 0" in server)
    check("calculator polish: LCD uses darker physical bezel", "border:5px solid #2e4a53!important" in server and "border-bottom-width:6px!important" in server)
    check("calculator polish: nav remains on silver island", "outline:5px solid #eef0ef!important" in server and "width:70px!important" in server and "height:47px!important" in server)
    check("calculator polish: green second key remains", "#bde36a" in server and "#96c342" in server)
    check("calculator polish: white numeric block remains", "#fbfaf8 0,#e0e3e0 100%" in server)
    check("calculator polish: secondary legends remain lime", "color:#bfdc66!important" in server and "top:-6px!important" in server)
    check("calculator fidelity v55.19: release style remains", 'id="v55-19-calculator-reference-fidelity"' in server)
    check("calculator fidelity v55.19: shell rails and taper remain", "#fafafa 0 5.6%" in server and "clip-path:polygon(8.3% 0,91.7% 0" in server)
    check("calculator fidelity v55.19: compact LCD bezel remains", "min-height:79px!important;height:79px!important" in server and "border-bottom-width:7px!important" in server)
    check("calculator fidelity v55.19: physical control deck geometry remains", "grid-template-columns:36px 36px 36px 31px 31px!important" in server and "grid-template-rows:20px 20px 20px!important" in server)
    check("calculator fidelity v55.19: oval nav remains on silver island", "width:68px!important;height:46px!important" in server and "outline:5px solid #f1f1ef!important" in server)
    check("calculator fidelity v55.19: keypad rhythm remains", "grid-template-rows:20px 20px 24px 25px 25px 27px!important" in server and "gap:8px 6px!important" in server)
    check("calculator fidelity v55.19: numeric labels stay prominent", "font-size:11.5px!important;font-weight:900!important" in server)
    check("calculator fidelity v55.19: popup remains stationary", "window.resizeBy" not in server and "window.resizeTo" not in server)


    check("calculator screenshot correction v55.21: release style remains", 'id="v55-21-calculator-screenshot-correction"' in server)
    check("calculator screenshot correction v55.21: duplicate decorative nav is hidden", ".si-model-navpad{display:none!important}" in server)
    check("calculator screenshot correction v55.21: compact LCD restored", "min-height:78px!important;height:78px!important" in server)
    check("calculator screenshot correction v55.21: compact control rows restored", "grid-template-rows:20px 20px 20px!important" in server and "row-gap:6px!important" in server)
    check("calculator screenshot correction v55.21: popup window contract unchanged", "popup=yes,width=340,height=650,left=8,top=8" in html and "window.resizeBy" not in server and "window.resizeTo" not in server)
    check("calculator popup fit v55.22: release style remains", 'id="v55-22-calculator-popup-fit"' in server)
    check("calculator popup fit v55.22: number rows have non-overlap height", "grid-template-rows:21px 21px 28px 29px 29px 30px!important" in server)
    check("calculator popup fit v55.22: preferred scale reduced", "const preferredScale=.82;" in server)
    check("calculator popup fit v55.22: smaller emergency floor allowed", "Math.max(.36,preferredScale*ratio*.975)" in server)
    check("calculator popup fit v55.22: finite post-layout checks remain", "setTimeout(fitCalculatorInsideWindow,60);" in server and "setTimeout(fitCalculatorInsideWindow,180);" in server and "setTimeout(fitCalculatorInsideWindow,420);" in server)
    check("calculator popup fit v55.22: no automatic window resize introduced", "window.resizeBy" not in server and "window.resizeTo" not in server and "ResizeObserver" not in server)
    check("shared screen preview v55.38: release style remains", 'id="v55-38-expanded-shared-screen-monitor"' in html)
    check("shared screen preview v55.38: desktop rail expands substantially", "grid-template-columns:minmax(0,1fr) 540px!important" in html and "width:540px!important" in html)
    check("shared screen preview v55.38: responsive rail fallbacks remain", "grid-template-columns:minmax(0,1fr) 500px!important" in html and "grid-template-columns:minmax(0,1fr) 450px!important" in html)
    check("shared screen preview v55.38: mirror stays responsive 16:9", 'id="v55-38-expanded-shared-screen-monitor"' in html and "aspect-ratio:16/9!important" in html and "flex:1 1 auto!important" in html and "padding:7px!important" in html)
    check("shared screen preview v55.38: lobby details scale with monitor", "width:94px!important" in html and "height:94px!important" in html and "font-size:22px!important" in html)
    check("shared screen preview v55.38: compact-width mirror can span wider", "width:min(760px,100%)!important" in html)
    check("shared screen preview v55.37: release style remains", 'id="v55-37-larger-shared-screen-preview"' in html)
    check("shared screen preview v55.37: desktop rail widens", "grid-template-columns:minmax(0,1fr) 390px!important" in html and "width:390px!important" in html)
    check("shared screen preview v55.37: medium rail remains responsive", "grid-template-columns:minmax(0,1fr) 350px!important" in html and "width:350px!important" in html)
    check("shared screen preview v55.37: mirror remains 16:9", "aspect-ratio:16/9!important" in html and "width:min(620px,100%)!important" in html)
    check("shared screen preview v55.36: release style remains", 'id="v55-36-shared-screen-preview-restore"' in html)
    check("shared screen preview v55.36: 16:9 frame restored", "aspect-ratio:16/9!important" in html and "height:auto!important" in html)
    check("shared screen preview v55.36: mirror content is flexible", "flex:1 1 auto!important" in html and "min-height:0!important" in html)
    check("shared screen preview v55.36: lobby qr fits preview", "width:58px!important" in html and "height:58px!important" in html)
    check("dashboard fit v55.35: release style remains", 'id="v55-35-dashboard-fit-edge-cases"' in html)
    check("dashboard fit v55.35: long roster labels are constrained", "text-overflow:ellipsis!important" in html and "overflow-wrap:anywhere!important" in html)
    check("dashboard fit v55.35: large rosters stay bounded", "repeat(auto-fit,minmax(92px,118px))!important" in html and "max-width:118px!important" in html)
    check("dashboard fit v55.35: mission controls wrap at laptop widths", "@media(max-width:1450px)" in html and "grid-column:1/-1!important" in html)
    check("dashboard fit v55.35: active inboxes are bounded", "max-height:220px!important" in html and "overscroll-behavior:contain!important" in html)
    check("dashboard fit v55.35: student keyboard safe area remains protected", "scroll-margin-bottom:110px!important" in html and "@media(max-height:620px)" in html)
    check("right rail v55.34: release style remains", 'id="v55-34-right-rail-empty-state-polish"' in html)
    check("right rail v55.34: inbox panels get empty-state class", "inboxEmptyStates.forEach" in html and "classList.toggle('is-empty',n===0)" in html)
    check("right rail v55.34: empty panels collapse", ".attention-panel.is-empty" in html and "min-height:46px!important" in html)
    check("right rail v55.34: shared screen preview is compact", ".screen-dock .mirror-screen" in html and "height:92px!important" in html)
    check("student join v55.33: release style remains", 'id="v55-33-two-step-student-join"' in html)
    check("student join v55.33: avatar tap advances directly", "joinAvatarDraft=b.dataset.joinAvatar;joinNameDraft='';joinStep='confirm';renderPublic()" in html)
    check("student join v55.33: avatar footer is removed", 'id="continueJoinBtn"' not in html and 'id="backToJoinCodeBottom"' not in html)
    check("student join v55.33: dedicated name nickname screen remains", "Your Name or Nickname" in html and "Name or nickname" in html and 'id="joinStudentName"' in html and 'id="joinClassBtn"' in html)
    check("student join v55.33: mobile join action stays viewport-safe", "position:sticky!important" in html and "bottom:0!important" in html and "env(safe-area-inset-bottom)" in html)
    check("snug roster cards v55.32: release style remains", 'id="v55-32-snug-roster-cards"' in html)
    check("snug roster cards v55.32: one-two student cards hug content", "grid-template-columns:repeat(auto-fit,max-content)!important" in html and "max-width:286px!important" in html and "grid-template-columns:118px max-content!important" in html)
    check("snug roster cards v55.32: avatar and text gap reduced", "column-gap:11px!important" in html and "width:116px!important" in html and "height:114px!important" in html)
    check("snug roster cards v55.32: three-four student cards hug content", "width:154px!important" in html and "min-height:184px!important" in html and "width:102px!important" in html and "height:101px!important" in html)
    check("compact roster pods v55.31: release style remains", 'id="v55-31-compact-roster-pods"' in html)
    check("compact roster pods v55.31: one-two student pods tighten", "minmax(305px,345px)" in html and "min-height:154px!important" in html and "width:122px!important" in html and "height:120px!important" in html)
    check("compact roster pods v55.31: three-four student pods tighten", "minmax(160px,190px)" in html and "min-height:198px!important" in html and "width:108px!important" in html and "height:107px!important" in html)
    check("compact roster pods v55.31: roster state remains presentation-only", "tighten sparse roster pods without reducing scanability" in html)
    check("single mission control v55.30: release style remains", 'id="v55-30-single-mission-control-bar"' in html)
    check("single mission control v55.30: visible control order is simplified", all(x in html for x in ('data-control="lobby"','data-control="activities"','data-control="agenda"','data-control="ready"','data-toggle="hand"','data-toggle="buzz"','data-toggle="help"','data-toggle="picture"','data-send="emotion"','data-send="understanding"')))
    check("single mission control v55.30: redundant controls are hidden compatibility hooks", 'mission-compat-controls hidden' in html and 'data-control="classroom"' in html and 'id="sessionSummaryBtn"' in html and 'id="sessionHistoryBtn"' in html and 'id="activityWorkflowPause"' in html and 'id="activityWorkflowFinish"' in html)
    check("single mission control v55.30: emergency and end remain visible", 'single-mission-danger' in html and 'id="emergencyReturnBtn"' in html and 'id="endBtn"' in html)
    check("single mission control v55.30: legacy group frames removed from visible bar", 'teacher-control-groups' not in segment(html, '<div class="teacher-controlbar single-mission-bar"', '<div class="mission-compat-controls'))
    check("mission control header v55.29: release style remains", 'id="v55-29-mission-control-header-cleanup"' in html)
    check("mission control header v55.29: activity context moved into header", all(x in html for x in ("missionContextName","missionContextState","missionContextDetail","mission-context-title")))
    check("mission control header v55.29: workflow actions live in session group", all(x in html for x in ('id="activityWorkflowStart"','id="activityWorkflowPause"','id="activityWorkflowFinish"',"mission-workflow-btn")))
    check("mission control header v55.29: legacy activity strip is visually suppressed", "#teacher #activityWorkflowBar{display:none!important}" in html and 'aria-hidden="true"' in html)
    check("mission control header v55.29: workflow handlers remain wired", all(x in html for x in ("workflowStart.onclick=startOrResumeActivityRun","workflowPause.onclick=sendActivityToLobby","workflowFinish.onclick=finishActiveActivity")))
    check("live roster compact v55.28: release style remains", 'id="v55-28-live-roster-compact"' in html)
    check("live roster compact v55.28: one-two student hero pods reduced", "min-height:168px!important" in html and "width:142px!important" in html and "height:140px!important" in html)
    check("live roster compact v55.28: three-four student pods reduced", "min-height:218px!important" in html and "width:123px!important" in html and "height:122px!important" in html)
    check("live roster compact v55.28: roster behavior remains presentation-only", "Presentation only: preserve roster state, alerts and authority." in html)
    check("match completion v55.27: release style remains", 'id="v55-27-match-completion"' in html)
    # Saved MATCH sets hold pair content; classroom rules belong to launch settings
    # and are copied into each run's matchConfig rather than saved with the set.
    match_save = segment(html, "function saveMatchDraft(")
    match_launch = segment(html, "function launchMatchSet(")
    check("match completion v55.27: launch settings remain separate from saved sets",
          all(x in match_save for x in ("const set={id:existing?.id", "name:String(matchDraft.name", "pairs,", "createdAt:existing?.createdAt")) and
          all(x not in match_save for x in ("matchLaunchSettings", "teamAssignments", "turnRule", "crewConsult")) and
          "const settings=deepClone(matchLaunchSettings)" in match_launch and
          "matchConfig:{setId:set.id,name:set.name,pairs:deepClone(set.pairs),mode:settings.mode" in match_launch and
          "matchTeamAssignments" in html)
    check("match completion v55.27: recommended team defaults remain", "mode:\'teams\'" in html and "teamCount:3" in html and "turnRule:\'one_each\'" in html and "crewConsult:true" in html)
    check("match completion v55.27: authoritative team rotation remains", "_match_team_members" in server and "_match_advance_turn" in server and "teamPlayerIndexes" in server and "activeTeam" in server)
    check("match completion v55.27: match-go-again rule remains", "match_go_again" in html and "match_go_again" in server and "go_again" in server)
    check("match completion v55.27: team scoring remains", "teamScores" in html and "teamScores" in server and "_match_team_index" in server)
    check("match completion v55.27: crew consult request path remains private", all(x in html for x in ("consult_open","consult_suggest","consult_close","matchConsultAggregate","data-match-consult-pick")) and all(x in server for x in ("consult_open","consult_suggest","consult_close")))
    check("match completion v55.27: consult privacy filter remains", 'activityId") or "") == "match-game"' in server and 'match["consult"] = {"open": False' in server and "own_name == active_name" in server)
    check("match completion v55.27: end-game options remain", all(x in html for x in ("matchPlayAgainBtn","matchRematchBtn","matchNewTeamsBtn","matchChooseSetBtn","BOARD CLEARED!")))
    check("match completion v55.27: new teams reshuffles assignments", "teamNonce=Date.now()" in html and "shuffleCopy(students||[],String(matchLaunchSettings.teamNonce))" in html)
    check("match completion v55.27: session summary captures scores", "t.scores={label:\'MATCH\'" in html and "teamScores" in html)
    check("bingo gameplay v55.26: release style remains", 'id="v55-26-bingo-gameplay"' in html)
    check("bingo gameplay v55.26: server-authoritative transport remains", 'mtype == "bingo_action"' in server and "_bingo_apply_request" in server and "teacher=False" in server and "teacher=True" in server)
    check("bingo gameplay v55.26: marks require called card item", 'kind == "mark"' in server and "value not in called" in server and "card_ids" in server)
    check("bingo gameplay v55.26: claim verification supports configured patterns", "_bingo_winning_sets" in server and all(x in server for x in ("corners","blackout","pattern == \"x\"","rows + cols")))
    check("bingo gameplay v55.26: private card state is role filtered", 'activityId") or "") == "bingo-game"' in server and 'bingo["cards"] = {own_name' in server and 'bingo["cards"] = {}' in server and 'bingo["marks"] = {own_name' in server)
    check("bingo gameplay v55.26: teacher caller controls remain", all(x in html for x in ("bingoCallNextBtn","bingoRepeatBtn","bingoClearRevealBtn","teacherBingoAction(\'call_next\'","teacherBingoAction(\'repeat\'")))
    check("bingo gameplay v55.26: private student mark and claim controls remain", "data-bingo-mark" in html and "studentBingoClaimBtn" in html and "wireBingoStudent" in html and "sendBingoAction(\'claim\')" in html)
    check("bingo gameplay v55.26: valid and not-yet feedback remains", "BINGO verified! Waiting for teacher reveal." in server and "Not yet — your card does not have a valid Bingo yet." in server)
    check("bingo gameplay v55.26: claim queue and reveal controls remain", "data-bingo-reveal-claim" in html and "data-bingo-dismiss-claim" in html and 'kind == "reveal_claim"' in server and 'kind == "dismiss_claim"' in server)
    check("bingo gameplay v55.26: shared reveal contains only winning card snapshot", "bingo-reveal-board" in html and 'bingo["reveal"]' in server and "claimId" in server)
    check("match gameplay v55.25: release style remains", 'id="v55-25-match-gameplay"' in html)
    check("match gameplay v55.25: server-authoritative action transport remains", 'mtype == "match_action"' in server and "_match_apply_request" in server and "teacher=False" in server and "teacher=True" in server)
    check("match gameplay v55.25: active-player validation remains", "_match_active_name" in server and "actor != active_name" in server and 'kind == "select"' in server)
    check("match gameplay v55.25: automatic pair detection remains", "pairId" in server and 'is_match = bool' in server and 'pendingResolution' in server)
    check("match gameplay v55.25: match and miss resolution remains", all(x in server for x in ("No match — remember those cards.", "MATCH!", "BOARD CLEARED!")))
    check("match gameplay v55.25: bounded undo history remains", "if len(history) > 20" in server and 'kind == "undo"' in server and 'kind == "retry"' in server)
    check("match gameplay v55.25: mission control recovery actions remain", all(x in html for x in ("matchLockBtn","matchPauseRevealBtn","matchContinueBtn","matchUndoBtn","matchRetryBtn","matchSkipBtn","matchNextTeamBtn","matchMarkBtn","matchReturnPairBtn")))
    check("match gameplay v55.25: student tile controls remain private to active turn", "data-match-pick" in html and "wireMatchStudent" in html and "sendMatchAction(\'select\'" in html)
    check("match gameplay v55.25: finite reveal timer remains teacher-only", "SESSION_ROLE!==\'teacher\'" in html and "scheduleMatchResolution" in html and "setTimeout" in segment(html, "function scheduleMatchResolution"))
    check("match gameplay v55.25: scoring and completion remain", "scores[actor]" in server and "matched_count >= all_cards" in server and "complete" in server)
    check("match+bingo foundation v55.24: release style remains", 'id="v55-24-match-bingo-foundation"' in html)
    check("match+bingo foundation v55.24: both apps are registered", "id:\'match\'" in html and "id:\'bingo\'" in html and "MATCH" in html and "BINGO" in html)
    check("match+bingo foundation v55.24: activity seeds remain", "id:\'match-game\'" in html and "id:\'bingo-game\'" in html and "type:\'match\'" in html and "type:\'bingo\'" in html)
    check("match+bingo foundation v55.24: shared image library persists", "siMothership.imageLibrary.v1" in html and "siMothership.imageLibrary.v1" in server and "importGameImages" in html)
    check("match+bingo foundation v55.24: saved set stores persist", all(x in html for x in ("siMothership.matchSets.v1","siMothership.bingoSets.v1","saveMatchDraft","saveBingoDraft")) and all(x in server for x in ("siMothership.matchSets.v1","siMothership.bingoSets.v1")))
    check("match+bingo foundation v55.24: MATCH builder and launch state remain", "state.activeApp===\'match\'" in html and "launchMatchSet" in html and "matchConfig" in html and "match:{cards" in html)
    check("match+bingo foundation v55.24: BINGO builder and private-card generator remain", "state.activeApp===\'bingo\'" in html and "launchBingoSet" in html and "bingoCardFor" in html and "bingoConfig" in html)
    check("match+bingo foundation v55.24: shared and student render branches remain", "a.type===\'match\'" in html and "a.type===\'bingo\'" in html and "student-game-foundation" in html and "foundation-public" in html)
    check("calculator key alignment v55.23: release style remains", 'id="v55-23-calculator-key-alignment"' in server)
    check("calculator key alignment v55.23: digit matcher uses action and label fallbacks", "action===\'digit\'+target" in server and "label===target" in server and "split(/\\\\s+/).includes(target)" in server)
    check("calculator key alignment v55.23: extras cannot overwrite row six", "const fallbackRow=6" not in segment(server, 'id="v55-17-reference-calculator-layout-script"') and "key.hidden=true" in segment(server, 'id="v55-17-reference-calculator-layout-script"') and "si-ref-extra-key" in server)
    check("calculator key alignment v55.23: five columns remain explicit", "grid-template-columns:repeat(5,minmax(0,1fr))!important" in server and "column-gap:6px!important" in server)
    check("calculator key alignment v55.23: operation column is muted", 'data-ref-col="5"' in server and "#5a6870" in server and "#384b54" in server)
    check("calculator key alignment v55.23: popup gets bottom safety margin", "margin-bottom:8px!important" in server)
    check("calculator reference accurate: arithmetic column remains physical", all(x in server for x in ("take([/divide|÷/])", "take([/multiply|×|\\*/])", "take([/subtract|minus|−/])", "take([/\\badd\\b|plus|\\+/])")))
    check("calculator reference accurate: number block remains pinned", all(x in server for x in ("takeDigit(7),takeDigit(8),takeDigit(9)", "takeDigit(4),takeDigit(5),takeDigit(6)", "takeDigit(1),takeDigit(2),takeDigit(3)", "takeDigit(0)")))
    check("calculator reference accurate: physical white nav surround remains", "si-ref-control-deck:after" in server and "width:96px" in server and "height:57px" in server)
    check("calculator reference accurate: SI-30XS face branding remains", "SI-30XS" in server and "MULTIVIEW" in server and "SI MOTHERSHIP" in server)
    check("calculator reference accurate: popup remains stable", "window.resizeBy" not in server and "window.resizeTo" not in server)

    # v56.0 space-station visual system.
    v56_style = re.search(r'<style id="v56-0-space-station-visual-system">(.*?)</style>', html, re.S)
    v56_css = v56_style.group(1) if v56_style else ""
    check("space station v56.0: dedicated visual system remains", bool(v56_style))
    check("space station v56.0: legacy device testing tabs removed", "Teacher Dashboard" not in html and '<div class="viewbar">' not in html and '<div class="tabs">' not in html)
    check("space station v56.0: join code remains in unified header", 'class="topbar v56-topbar' in html and 'class="class-code"' in html and 'id="copyCode"' in html)
    check("space station v56.0: teacher control behavior hooks remain", 'id="teacherControlBar"' in html and 'data-control="lobby"' in html and 'data-toggle="buzz"' in html and 'data-send="understanding"' in html)
    check("space station v56.0: avatar-forward neon controls remain", "--station-cyan:#45e8ff" in v56_css and "#teacher .single-mission-controls .control" in v56_css and "#teacher .bot-card" in v56_css)
    check("space station v56.0: command viewport remains", "#teacher .deck-header:before" in v56_css and "YOUR CLASSROOM · CONNECTED · ON A MISSION" in v56_css)
    check("space station v56.0: activity modules remain dimensional", "#teacher .app-shortcut-icon" in v56_css and "translateY(-4px)" in v56_css)
    check("space station v56.0: shared screen monitor styling remains", "#teacher .right-rail .screen-dock .mirror-screen" in v56_css and "aspect-ratio:16/9" in html)

    # v56.1 command deck polish.
    v561_style = re.search(r'<style id="v56-1-command-deck-polish">(.*?)</style>', html, re.S)
    v561_css = v561_style.group(1) if v561_style else ""
    check("command deck v56.1: dedicated polish layer remains", bool(v561_style))
    check("command deck v56.1: console modules remain avatar-inspired", "--module:#45e8ff" in v561_css and "#teacher .single-mission-controls .control:nth-child(8)" in v561_css)
    check("command deck v56.1: cockpit framing remains", "#teacher .workspace:before" in v561_css and "#teacher .single-mission-bar:before" in v561_css)
    check("command deck v56.1: roster pod polish remains", "#teacher .roster-card.sparse-roster .crew" in v561_css and "#teacher .bot-card" in v561_css)
    check("command deck v56.1: activity modules remain dimensional", "#teacher .app-shortcut-icon:after" in v561_css and "width:62px" in v561_css)
    check("command deck v56.1: right rail monitor polish remains", "#teacher .screen-dock .mirror-screen:after" in v561_css and "#teacher .attention-summary-copy span:before" in v561_css)

    # v56.2 illustrated control system.
    v562_style = re.search(r'<style id="v56-2-illustrated-control-system">(.*?)</style>', html, re.S)
    v562_css = v562_style.group(1) if v562_style else ""
    check("illustrated controls v56.2: dedicated artwork layer remains", bool(v562_style))
    check("illustrated controls v56.2: embedded WebP sprite remains", "data:image/webp;base64," in v562_css and "--v562-sprite" in v562_css)
    check("illustrated controls v56.2: all primary control art classes remain", all(x in html for x in ["v562-control-lobby","v562-control-activities","v562-control-agenda","v562-control-ready","v562-control-hand","v562-control-buzz","v562-control-help","v562-control-picture","v562-control-emotion","v562-control-understanding","v562-control-end"]))
    check("illustrated controls v56.2: shortcut image mapping remains", "function appIllustratedIconClass" in html and "v562-app-scientific-calculator" in html and "appIllustratedIconMarkup(app.id)" in html)
    check("illustrated controls v56.2: image tiles stay interactive through original hooks", 'data-control="lobby"' in html and 'data-toggle="buzz"' in html and 'data-send="understanding"' in html and 'id="endBtn"' in html)
    check("illustrated controls v56.2: sprite positions cover shortcut row", "v562-app-si-plus" in v562_css and "v562-app-starwheel" in v562_css and "v562-app-scientific-calculator" in v562_css)

    # v56.3 Activity Library visual integration.
    v563_style = re.search(r'<style id="v56-3-activity-library-visual-integration">(.*?)</style>', html, re.S)
    v563_css = v563_style.group(1) if v563_style else ""
    check("activity library v56.3: dedicated integration layer remains", bool(v563_style))
    check("activity library v56.3: shortcut manager uses illustrated assets", "appIllustratedIconMarkup(app.id)" in html and "#activitiesPanel .shortcut-manage-icon>.v562-art" in v563_css)
    check("activity library v56.3: recent shelf uses illustrated assets", "appIllustratedIconMarkup(item.appId)" in html and "#activitiesPanel .recent-app-icon>.v562-art" in v563_css)
    check("activity library v56.3: presets carry artwork identity", "preset-card-icon" in html and "#activitiesPanel .preset-card-icon>.v562-art" in v563_css)
    check("activity library v56.3: catalog cards use illustrated assets", "#activitiesPanel .activity-catalog-grid .act-icon>.v562-art" in v563_css and "appIllustratedIconMarkup(app.id)" in html)
    check("activity library v56.3: top illustrated controls remain crisp", "brightness(1.18)" in v563_css and "#teacher .single-mission-controls .control .ico.v562-art" in v563_css)
    check("activity library v56.3: shortcut actions remain functional", 'data-shortcut-replace="' in html and 'data-shortcut-remove="' in html and 'data-open-app="' in html)

    # v56.4 station modules and empty states.
    v564_style = re.search(r'<style id="v56-4-station-modules-empty-states">(.*?)</style>', html, re.S)
    v564_css = v564_style.group(1) if v564_style else ""
    check("station modules v56.4: dedicated integration layer remains", bool(v564_style))
    check("station modules v56.4: roster header uses illustrated badge", "v562-app-crew-survey" in html and "v564-panel-art" in html)
    check("station modules v56.4: right rail modules use illustrated badges", all(x in html for x in ["v562-control-buzz","v562-control-picture","v562-control-help","v562-control-understanding"]))
    check("station modules v56.4: shared screen module keeps illustrated badge", "SHARED SCREEN" in html and "v562-control-lobby" in html)
    check("station modules v56.4: empty roster gets illustrated scanner state", "v564-empty-roster" in html and "CREW SCANNER" in html and "#teacher .v564-empty-roster-art>.v562-art" in v564_css)
    check("station modules v56.4: ended panel keeps illustrated mission-complete art", "v564-session-complete-art" in html and "#teacher .v564-session-complete-art>.v562-art" in v564_css)
    check("station modules v56.4: shared screen functionality hooks remain", 'id="launchSecondScreenBtn"' in html and 'id="mirrorContent"' in html and 'id="mirrorLabel"' in html)

    # v56.5 illustrated asset refinement.
    v565_style = re.search(r'<style id="v56-5-illustrated-asset-refinement">(.*?)</style>', html, re.S)
    v565_css = v565_style.group(1) if v565_style else ""
    check("illustrated assets v56.5: dedicated refinement layer remains", bool(v565_style))
    check("illustrated assets v56.5: artwork gets per-module accent framing", "--art-accent:#59e8ff" in v565_css and ".v562-control-end{--art-accent:#ff6f96" in v565_css)
    check("illustrated assets v56.5: primary control art remains prominent", "width:48px!important" in v565_css and "#teacher .single-mission-controls .control .ico.v562-art" in v565_css)
    check("illustrated assets v56.5: state styling stays on hardware frame", "State belongs to the hardware frame" in v565_css and "opacity:1!important" in v565_css)
    check("illustrated assets v56.5: shortcut art remains enlarged and crisp", "#teacher .app-shortcut-icon" in v565_css and "width:66px!important" in v565_css)
    check("illustrated assets v56.5: activity library art refinement remains", "#activitiesPanel .activity-catalog-grid .act-icon>.v562-art" in v565_css)
    check("illustrated assets v56.5: original behavior hooks remain", 'data-control="lobby"' in html and 'data-toggle="hand"' in html and 'data-send="emotion"' in html and 'id="endBtn"' in html)

    # v56.6 header and command deck polish.
    v566_style = re.search(r'<style id="v56-6-header-command-deck">(.*?)</style>', html, re.S)
    v566_css = v566_style.group(1) if v566_style else ""
    check("command header v56.6: dedicated polish layer remains", bool(v566_style))
    check("command header v56.6: illustrated brand module remains", "v566-brand-mark" in html and "v562-app-si-plus" in html)
    check("command header v56.6: live status block remains", "v566-live-pill" in html and "Classroom LIVE" in html)
    check("command header v56.6: class and join-code modules remain", "class-context" in html and 'id="copyCode"' in html and "JOIN CODE" in html)
    check("command header v56.6: cinematic viewport remains", "v566-space-viewport" in html and "v566-planet" in html and "#teacher .v566-space-viewport" in v566_css)
    check("command header v56.6: mission metrics remain dynamic", 'id="connectedMetric"' in html and "MISSION TIME" in html and "#teacher .v566-metrics" in v566_css)
    check("command header v56.6: reset behavior hook remains", 'id="resetBtn"' in html)
    check("command header v56.6: teacher mission title remains dynamic", 'id="missionTitle"' in html)

    # v56.7 button system and crew pod polish.
    v567_style = re.search(r'<style id="v56-7-button-system-crew-pods">(.*?)</style>', html, re.S)
    v567_css = v567_style.group(1) if v567_style else ""
    check("button system v56.7: dedicated cleanup layer remains", bool(v567_style))
    check("button system v56.7: mission-control module geometry is normalized", "width:76px!important" in v567_css and "min-height:76px!important" in v567_css)
    check("button system v56.7: recognizable top control overlays remain", 'content:"⌂"!important' in v567_css and 'content:"✋"!important' in v567_css and 'content:"♥"!important' in v567_css)
    check("button system v56.7: activity launcher tiles remain normalized", "#teacher .home-app-grid" in v567_css and "grid-template-columns:repeat(9" in v567_css and "width:66px!important" in v567_css)
    check("button system v56.7: one-student crew pod polish remains", "grid-template-columns:320px!important" in v567_css and "width:320px!important" in v567_css)
    check("button system v56.7: literal escaped header gap is removed", "</header>\\n\\n<section id=\"teacher\"" not in html)
    check("button system v56.7: classroom behavior hooks remain", 'id="teacherControlBar"' in html and 'data-control="activities"' in html and 'data-toggle="picture"' in html and 'id="endBtn"' in html)

    # v56.8 unified button system.
    v568_style = re.search(r'<style id="v56-8-unified-button-system">(.*?)</style>', html, re.S)
    v568_css = v568_style.group(1) if v568_style else ""
    check("unified buttons v56.8: dedicated layer remains", bool(v568_style))
    check("unified buttons v56.8: activity shortcuts are centered fixed modules", "grid-template-columns:repeat(9,84px)!important" in v568_css and "justify-content:center!important" in v568_css)
    check("unified buttons v56.8: classroom controls use launcher geometry", "grid-template-rows:62px 20px!important" in v568_css and "#teacher .single-mission-controls .control" in v568_css)
    # Current art tiles use a 15px rounded edge inside the 60px module.
    tile_art = re.search(r"#teacher \.single-mission-controls \.control \.ico\.v562-art\{(.*?)\}", v568_css, re.S)
    check("unified buttons v56.8: classroom art tiles match shortcut family",
          bool(tile_art) and "width:60px!important" in tile_art.group(1) and
          "height:60px!important" in tile_art.group(1) and
          "border-radius:15px!important" in tile_art.group(1) and
          "#teacher .v562-end-btn .v562-art" in v568_css)
    check("unified buttons v56.8: state styling stays on art tiles", "#teacher .single-mission-controls .control.active .ico.v562-art" in v568_css and "#teacher .single-mission-controls .control.enabled .ico.v562-art" in v568_css)
    check("unified buttons v56.8: end session joins unified family", "#teacher .v562-end-btn" in v568_css and "grid-template-rows:62px 20px!important" in v568_css)
    check("unified buttons v56.8: behavior hooks remain", 'data-control="lobby"' in html and 'data-toggle="buzz"' in html and 'data-send="understanding"' in html and 'id="endBtn"' in html)

    # v56.8.1 shortcut centering hotfix.
    v5681_style = re.search(r'<style id="v56-8-1-shortcut-centering-fix">(.*?)</style>', html, re.S)
    v5681_css = v5681_style.group(1) if v5681_style else ""
    check("shortcut centering v56.8.1: dedicated fix layer remains", bool(v5681_style))
    check("shortcut centering v56.8.1: shortcut cluster uses intrinsic width", "width:max-content!important" in v5681_css and "margin-left:auto!important" in v5681_css and "margin-right:auto!important" in v5681_css)
    check("shortcut centering v56.8.1: desktop nine-slot geometry remains", "grid-template-columns:repeat(9,84px)!important" in v5681_css)
    check("shortcut centering v56.8.1: responsive groups remain centered", "repeat(5,84px)!important" in v5681_css and "repeat(3,84px)!important" in v5681_css)
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
