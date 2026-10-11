"""Guarded, one-time MILLION upgrade for the monolithic existing index.html.
Only touches MILLION setup/launch/reveal flow; every other game stays intact.
Run in GitHub Actions against the pinned 2026-10-10 source tree.
"""
from pathlib import Path
import hashlib
import re

path = Path('index.html')
raw = path.read_bytes()
sha = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
EXPECTED = '5b60cfad64ed0b63b09275d328f4fbc137f2ec1a'
if sha != EXPECTED:
    raise SystemExit(f'ABORT: main index blob changed; expected {EXPECTED}, got {sha}')
text = raw.decode('utf-8')

def replace_once(old, new):
    global text
    occurrences = text.count(old)
    if occurrences != 1:
        raise SystemExit(f'ABORT: anchor count {occurrences}, expected 1: {old[:110]}')
    text = text.replace(old, new, 1)

replace_once(
    "const students=connectedStudents(),questions=parseMillionQuestions(millionDraft.questionsText);",
    "const students=connectedStudents(),questions=window.MillionStudio?window.MillionStudio.questions():parseMillionQuestions(millionDraft.questionsText);"
)
replace_once(
    "questions,pilotMode:millionDraft.pilotMode||'rotate',risk:millionDraft.risk||'practice',",
    "questions,gameName:window.MillionStudio?window.MillionStudio.currentName():'MILLION',pilotMode:millionDraft.pilotMode||'rotate',risk:millionDraft.risk||'practice',"
)
replace_once(
    "checkpoints:[5,10],ladder:[100,200,300,500,1000,2000,4000,8000,16000,32000,64000,125000,250000,500000,1000000],",
    "checkpoints:window.MillionStudio?window.MillionStudio.checkpoints(questions.length):[5,10],ladder:window.MillionStudio?window.MillionStudio.ladder(questions.length):[100,200,300,500,1000,2000,4000,8000,16000,32000,64000,125000,250000,500000,1000000],"
)
# Prevent a stale/double reveal or accidental teacher judgment. The locked
# key is always scored against the authored question's correct key.
resolve = "const run=state.activityRun,m=millionState(run),cfg=millionConfig(run),q=millionQuestion(run);if(!m||!q)return;"
index = text.index('function millionResolve(correct){')
loc = text.index(resolve, index)
text = text[:loc] + resolve.replace(
    "if(!m||!q)return;",
    "if(!m||!q||!m.lockedAnswer||m.revealed)return;correct=m.lockedAnswer===q.correct;"
) + text[loc+len(resolve):]
replace_once(
    "const millionCorrect=$('#millionCorrectBtn');if(millionCorrect)millionCorrect.onclick=()=>millionResolve(true);",
    "const millionCorrect=$('#millionCorrectBtn');if(millionCorrect)millionCorrect.onclick=()=>millionResolve(millionState()?.lockedAnswer===millionQuestion()?.correct);"
)
replace_once("✓ SIGNAL CONFIRMED</button><button class=\"danger-action\" id=\"millionWrongBtn\"", "◆ REVEAL ANSWER</button><button class=\"danger-action\" id=\"millionWrongBtn\"")
# No skipping locked/reveal stage via stale clicks.
next_anchor = "function millionNextQuestion(){"
at = text.index(next_anchor)
segment = text[at:at+530]
old = "if(m.complete)return toast('Mission complete');"
assert old in segment, 'Next-question guard not found'
segment = segment.replace(old, old + "if(!m.revealed&&!m.over)return toast('Reveal the answer before moving on');", 1)
text = text[:at] + segment + text[at+530:]

# Replace ONLY existing MILLION settings tab; a shared teacher-only Studio
# script now renders the structured pre-labeled slides and Game Library.
anchor = "  if(state.activeApp==='million'){"
start = text.index(anchor, text.index('function renderActivities('))
end = text.index("  if(state.activeApp==='cosmic-cards'){", start)
old_branch = text[start:end]
assert 'millionQuestionsText' in old_branch
new_branch = """  if(state.activeApp==='million'){
    note.classList.add('hidden');picker.classList.add('hidden');grid.classList.remove('hidden');
    title.textContent='MILLION';subtitle.textContent='Question slide editor · create, save and load complete game shows.';
    header.innerHTML='<button id="backToAppsBtn">← Activity Library</button>';
    $('#backToAppsBtn').onclick=backToAppLibrary;
    grid.innerHTML=window.MillionStudio?window.MillionStudio.markup():'<div class="game-show-card">MILLION Studio is loading…</div>';
    if(window.MillionStudio)window.MillionStudio.wire();
    return;
  }

"""
text = text[:start] + new_branch + text[end:]

assert 'if(state.activeApp===\'million\')' in text
assert text.count('function launchMillion(){')==1
assert 'function millionResolve(correct){' in text
assert 'window.MillionStudio.questions()' in text
assert len(text)>1400000, 'unexpected source size'
path.write_text(text, encoding='utf-8')
print('MILLION UPGRADE PATCH APPLIED', len(raw), '->', path.stat().st_size)
