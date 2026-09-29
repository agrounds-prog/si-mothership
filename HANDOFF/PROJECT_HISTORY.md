# Project / Release History

This is the condensed development history carried forward from the previous project chats.

## Earlier stable foundation
- v42: multi-device/session reliability and student-owned server merge.
- v44: hosted auth/persistence.
- v44.5: BOARD drawing-sync guard.
- v44.6: synchronous popup opening.
- v44.7: real Railway QR/session URLs.
- v45: Pixel Focus Reveal, uniform VECTOR markers, Minefield Beacon Hunt.
- v46: Classroom Polish.
- v49.5: responsive polish.
- v49.6: activity hardening.
- v50.0: persistent Sketch Signal word packs.
- v50.1: optional individual/team Sketch scoring.
- v50.2: batch avatar-set importing.
- v50.3: STARWHEEL core game.
- v50.4: saved STARWHEEL puzzle packs, special sectors, Final Signal, score correction, puzzle-to-puzzle score/pilot carry-over.

## v50.5 — Activity Presets + Recent Activities
- Teacher-only reusable setups and lightweight recent-config snapshots.
- Launch/Open/Edit/Update/Delete.
- Config coverage for MINEFIELD, Sketch, STARWHEEL, ORBIT, VECTOR, PIXEL REVEAL, BOARD, SI+.
- Presets/recents server-persisted, excluded from public storage.
- Sketch/STARWHEEL team assignments remain session-only.

## v50.6 — Live Session Summary
Tracks:
- session duration
- attendance/students seen
- peak connected
- activities and duration
- participants/responses
- Ready Checks
- Ask for Help count
- photo submission count
- per-student participation
- Sketch/STARWHEEL score summaries
Live tracker is teacher-only and outside synchronized state.

## v50.7 — Persistent Session History
- Summary, History, End Session workflow.
- Completed sessions saved only on End Session.
- Open/Copy/Export/Delete plus Clear History.
- Retention limit: 60.
- No raw photo blobs or help-message body text.
- Production milestone SHA at that time: cee21612f480a1d29e450326cbad9e01c1ad1eab.

## v50.8 — Classroom Workflow
- Persistent activity lifecycle status strip.
- Start/Resume.
- Pause & Keep Progress.
- Finish & Return.
- Clear distinction between preserving progress and ending a run.
- Emergency Return unchanged.

## v50.9 — Regression Automation + Release Safety
- Added scripts/release_gate.py.
- Added GitHub Actions release-gate workflow.
- Automated privacy, selector, lifecycle, Sketch and STARWHEEL invariants.

## v51.0 — Mission Control Polish
- Mission Control grouped into Navigation, Student Response, Session.
- Students See status separated into its own strip.
- Picture renamed to Picture Prompt.
- UI-only release.

## v51.1 — Teacher Attention Rail
- Class Alerts summary.
- Help/Buzz/Photo counts.
- Visual emphasis for active attention areas.
- Shared Screen remains separate monitor tool.

## v51.2 — STARWHEEL Hotfix
User reported:
- wheel would not randomize/spin correctly
- student lacked non-vowel letter selection
Fixes:
- dedicated server-authoritative starwheel_action message
- obvious main-card Spin Starwheel button
- repaired multi-selector $$() bindings
- strengthened release gate around STARWHEEL transport/UI

## v51.3 — STARWHEEL Hardening
- explicit active-pilot prompts
- numeric spin -> letter stage checks
- consonant -> ready checks
- correct/miss rotation assertions
- relative landing-angle correction

## v51.4 — STARWHEEL Animation Fix
- SHA: 4909fccadf97a4baf68799e36239ffe252c3d9ac
- Commit message: v51.4 fix STARWHEEL animation and landing alignment
- Changed index.html, server.py, release gate.
- Exact CI run passed.

## v52.0 — Visual System Refresh
- SHA: 55745fb25b2055212e95d3beb531774b419a1390
- Commit message: v52.0 establish cohesive visual design system
- Diff from v51.4: index.html +286/-1; server.py +2/-2.
- Exact GitHub Actions release gate passed.
- Railway production pinned to exact SHA.
- Latest successful deployment: 5a30acc3-4356-470a-be5b-6302ff1f5059.
