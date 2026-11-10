# SI Mothership — Minefield Risk + Reward Art Pack

This is a **ready-to-upload GRAPHICS ZIP**, not an executable gameplay patch.
It includes a complete set of independent transparent PNG skins, cinematic backgrounds, three concept references, a JSON manifest with paths and checksums, and implementation guidance.

## Upload to GitHub

Upload the ZIP to the GitHub repository if that's your existing handoff workflow, **or** extract and upload the `assets/minefield-v2/` folder to `agrounds-prog/si-mothership` on `main`. Keep the paths unchanged. A ZIP uploaded to GitHub's root is *not* automatically extracted; the implementation step must extract or commit the individual PNGs.

## Image inventory

- `backgrounds/` — shared 16:9, teacher 16:9, compact student 9:16, deep-space alternative, 4 text-free texture swatches.
- `frames/` — responsive board frames and separate narrator, teacher, student, health/score, legend, stats, last-action, saved-set and result panels.
- `tiles/` — hidden, safe-point levels 1 through 5, heart bonus, mine, inactive and focus states. **Numbers are not baked into tile images.**
- `icons/` — red heart, green heart, score star, mine, target, satellite, navigator, turn, warning, safe, settings and flag.
- `buttons/` — wide blank raster skins for blue, green, amber, red, slate, cyan and disabled buttons. HTML text remains live and accessible.
- `banners/` — blank state/status plaques for health, score, turn, navigator, ready, reveal, mine hit, win, loss and scoring.
- `effects/` — transparent ring overlays for safe reveal, points, health recharge, mine strike, focus, and scanline.
- `screens/` — text-free win and loss backgrounds for presenting the final result.
- `references/` — approved concept and two generated component sheets for visual QA only. **Do not use the full composite concept as the playable interface.**

## Integration instructions

Existing game mechanics / data storage / timers / turn progression should be preserved when wiring in these art files. Use actual `<button>` and text nodes over transparent image-backed skins; do not replace interactive elements with a single screenshot. Retain high-DPI proportional image fit with `background-size: 100% 100%` for state tile PNGs and button backgrounds, or `border-image` nine-slicing for board edges. The `frame_board_concept_rail.png` has a transparent center and is suitable as a non-interactive `pointer-events:none` board decoration.

Recommended mapping:

| Minefield surface | Art file(s) |
| --- | --- |
| Shared screen root | `backgrounds/background_mission_16x9.png` |
| Teacher studio | `backgrounds/background_teacher_16x9.png`, `frames/panel_teacher_settings.png`, `frames/panel_saved_missions.png` |
| Student companion | `backgrounds/background_student_9x16.png`, `frames/panel_student_controls.png` |
| Grid | `frames/frame_board_outer.png` or `frames/frame_board_concept_rail.png` plus `tiles/tile_hidden.png` |
| Revealed safe tile | `tiles/tile_safe_1pt.png` … `tiles/tile_safe_5pt.png` plus **live** value text |
| Bonus and mine tile | `tiles/tile_health_bonus.png`, `tiles/tile_mine.png` |
| Narrator | `frames/panel_narrator.png`, `frames/panel_mission_briefing.png`, empty state banners |
| Health, score and turn | `frames/panel_scoreboard.png`, `banners/banner_health_empty.png`, `banners/banner_score_empty.png`, `banners/banner_turn_empty.png` and icon art |
| Rules/point legend | `frames/panel_legend.png`, 1–5 point tile assets, live text |
| Save/load/launch/pause/reset | Graphic buttons under `buttons/` with existing HTML labels |
| Game over / crew victory | `screens/` end-state backgrounds and empty win/loss plaques |

### Proposed Risk + Reward rule spec (for the next implementation pass)

On revealing a **safe** square, award `1 + min(4, adjacentMineCount)` crew points, where adjacent means the eight surrounding squares (including diagonals). Thus 0 adjacent mines = 1 point, 1 = 2, 2 = 3, 3 = 4, and 4+ = 5 points. Hidden tiles must not reveal their value in advance; students infer risky locations from previous reveals and decide where to click. A mine deducts one health and awards zero points; a heart adds one health (up to the configured maximum). Preserve existing team/turn progression and current win condition until the requested scoring behavior is implemented and fully regression tested.

Game code and authoritative score logic must be updated in a separate commit when implementing this rule. Merely uploading these graphics does **not** change rules.

### Quality and accessibility checklist

1. Graphic background files render on teacher, shared and student screens; no missing or stretched fake game boards.
2. Every numbered tile remains legible and available to screen readers, including all 3×3 through 6×6 board sizes if Minefield supports them.
3. Keyboard focus and all button hit targets remain usable, including the Zoom companion window.
4. Replay, pause/resume, reconnect, save/load and scoreboard remain synchronized.
5. WebSocket or shared-state updates do not reset the visible score/turn or replay a reveal animation.
6. Clean old tile/header CSS overrides so art image layers do not duplicate visual framing.

**Production asset directory:** `/assets/minefield-v2/` in the repo. This pack's asset files are standalone PNGs and need no custom font or proprietary runtime.
