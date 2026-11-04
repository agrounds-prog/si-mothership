# SI Mothership — Visual Consistency Program
Status: baseline / design-system definition (2026-11-03)
Reference experience: **BINGO Teacher Studio**, not a literal template for gameplay.
Scope: Teacher Studio, live teacher controls, Shared Screen, student companion (440 × 780), empty/loading/saved states.

## Why BINGO is the baseline
The existing `bingo-board-studio.css` establishes a consistent premium visual vocabulary: dark blue radial-gradient panels, cyan and mint highlights, a recognizable hero/header, clear progress state, strong rounded panel boundaries, focus-visible styles, and distinct board/controls hierarchy. Keep BINGO's useful patterns while reducing overly decorative or redundant chrome. This is a code-level baseline; visual/browser comparison remains to be completed.

## Shared UI contract
1. **Shell:** one compact branded hero with app icon, app name, a one-sentence purpose, and a single primary action; no redundant nested headers.
2. **Studio:** left/primary creation canvas; secondary controls organized into labeled cards. Save, Load, New and Launch always identifiable and consistently located.
3. **Live teacher controls:** one compact control deck, obvious active/disabled/danger states, predictable navigation and session state.
4. **Shared screen:** prioritize game content over chrome; 16:9 responsive viewport, no horizontal clipping, no tiny labels; never expose teacher-only editing.
5. **Student companion:** legible and tappable at 440 × 780; essential action visible without scrolling; no overlapping alerts.
6. **Typography:** Inter/system UI; hero title 26–40 px, panel heading 15–20 px, body 13–16 px, control labels >=12 px where practical, never use tiny 9px text for essential information.
7. **Colors:** deep navy foundation, cyan focus/primary, mint success, amber caution, red destructive; color never conveys state alone.
8. **Components:** shared card radii ~16–20 px, buttons ~10–12 px, clear 2px focus ring, restrained glow; accessible contrast and 44px touch targets for student controls.
9. **States:** loading, empty, upload, saved, error, disconnected, paused, session complete; consistent messaging and actionable recovery.
10. **Persistence:** styling must not alter activity schemas, teacher data, student avatars, saved presentations or Railway /data.

## Rollout order
- Phase A: refine BINGO as reference (studio + teacher live controls + shared screen + compact student view), capture before/after screenshots at desktop, 1280×720, 16:9 projector, 440×780 student.
- Phase B: extract scoped design tokens and reusable component classes; migrate one low-risk activity to prove parity.
- Phase C: audit and migrate PIXEL REVEAL, MATCH, MILLION, CREW SURVEY, SPOTLIGHT, ORBIT.
- Phase D: audit and migrate SI+, Quick Poll, Star Wheel, Minefield, Cosmic Cards, Dominoes, Four In Line, Word Grid, Signal Sequence and remaining activities.
- Phase E: full regression across teacher/student/shared-screen, saved-set restoration, lobby workflow and release gate.

## Visual audit checklist (score each 0–3)
- App identity / header consistency
- Hierarchy / use of space
- Buttons / controls / state readability
- Studio creation + saved activity workflow
- Shared-screen cinematic composition
- Student companion usability at 440×780
- Empty / error / completion states
- Responsiveness / accessibility
- Animation / transitions (no distraction)
- Functional regression / persistence

For each app record screenshots, differences from baseline, changes made, and test results. No app is considered migrated until the three surfaces are reviewed and relevant tests pass.

## Non-goals
Do not make all games look identical; preserve distinctive gameplay imagery and mechanics. No lesson sequencing; preserve lobby navigation. Do not make global CSS changes until scoped selectors and regression coverage are established.
