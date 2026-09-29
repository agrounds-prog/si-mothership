# Current State — v52.0

## Product architecture
- Teacher surface: Mission Control.
- Student surface: phone-sized/viewport classroom UI.
- Shared Screen: clean view-only projector/mirror route.
- Backend: Python aiohttp + WebSockets + SQLite.
- Persistent DB: /data/mothership_data.sqlite3.
- One Railway replica only.

## Current Mission Control
Navigation:
- Lobby
- Classroom
- Agenda
- Activities

Student Response:
- Ready Check
- Raise Hand
- Buzz
- Ask for Help
- Picture Prompt
- Emotion
- Understanding

Session:
- Summary
- History
- Emergency Return
- End Session

The right rail has a Class Alerts summary for Help, Buzz, and Photo Inbox, plus Shared Screen.

## Activity lifecycle
- Start / Resume
- Pause & Keep Progress: sends students to Activity Lobby, preserves activityRun.
- Finish & Return: ends the run and returns to Classroom Controls.
- Emergency Return remains distinct.

## Persistent teacher-only features
- Activity presets: siMothership.activityPresets.v1
- Recent activities: siMothership.recentActivities.v1
- Session history: siMothership.sessionHistory.v1
These are persisted server-side but excluded from public/student storage.
Session history is saved only by End Session and excludes raw photo image data and raw help-message text.

## STARWHEEL
Preserve:
- server-authoritative spins and scoring
- dedicated starwheel_action transport
- active-pilot validation
- student Spin Starwheel control
- consonant selection only after numeric spin
- vowels separate from consonants
- used letters disabled
- private Solve Signal review
- saved puzzle packs
- special sectors
- Final Signal
- score carry between pack puzzles
- teacher score correction
- Free-for-All and crew/team modes
- automatic pilot rotation

Recent fixes:
- v51.2 dedicated STARWHEEL action channel and repaired $$() button bindings.
- v51.3 stage-flow hardening and relative landing-angle math.
- v51.4 animation/landing alignment fix.
Do not casually rewrite STARWHEEL authority or transport.

## Sketch Signal
Preserve:
- 4:3 shared canvas
- non-flickering live-ink patch behavior
- team selection/scoring
- private student guesses
- team assignments are current-session state, not saved into presets

## Release gate
scripts/release_gate.py and .github/workflows/release-gate.yml protect:
- inline JS parse
- $() vs $$() selector invariant
- activity launch -> session summary hooks
- teacher-only storage boundaries
- pause/finish/emergency semantics
- End Session -> persistent history
- Sketch Signal critical paths
- STARWHEEL authority/privacy/stage/transport invariants
- /api/health presence

Historical selector trap:
JavaScript String.replace replacement strings interpret $$.
When replacement text contains $$ use:
  source.replace(oldText, () => newText)
not:
  source.replace(oldText, newText)

## v52.0 visual direction
Current main is v52.0 — Visual System Refresh.
The visual direction is dark, refined, professional classroom control-room software: less neon/game UI, more consistent hierarchy; color reserved for live status and attention.
v52.0 changed only index.html styling/design foundation plus server version labeling. GitHub Actions passed and Railway production is pinned to the same SHA.

## Next planned visual phases
- v52.1 Teacher Mission Control visual refinement.
- v52.2 Student UI refinement.
- v52.3 Shared activity visual consistency.
- v52.4 Modals, setup screens, Activity Library, presets/recents, Summary/History polish.
Keep these incremental and regression-safe.
