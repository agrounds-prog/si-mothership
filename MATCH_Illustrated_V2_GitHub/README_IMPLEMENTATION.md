# SI Mothership MATCH Illustrated V2 — GitHub implementation handoff

**Project:** `agrounds-prog/si-mothership` · branch `main`  
**Production:** https://mothership-web-production.up.railway.app/  
**Goal:** reproduce the approved *graphical* MATCH Teacher Studio, replacing flat control skins with **real image-backed assets**. This is not a flattened screenshot and not a change to gameplay.

## Contents

- `references/approved_match_concept.png` — the selected design target.
- `references/graphical_skin_atlas.png` — preview of 20 original production PNG components.
- `assets/match-illustrated-v2/*.png` — 20 transparent, text-free button, tile, border, chip, and panel skins.
- `assets/match-illustrated-v2/*.svg` — vector equivalents of the main skins, used by the supplied production CSS (crisper at multiple widths).
- `match-illustrated-v2.css` — scoped, production-ready styles using the SVG assets.
- `scripts/build_match_art_v2.py` — reproducible PNG generator (Pillow).
- `tests/test_match_illustrated_v2_browser.cjs` — Chromium visual and behavior smoke test.
- `INTEGRATION_NOTES.md` — explicit server and test wiring instructions.

## Implementation scope

Use the graphics in **MATCH Creator only**, inside `#teacher #activitiesPanel.si-mp-match-studio`; preserve the existing teacher/student/shared-screen runtime, MATCH pair construction, saved/recent image libraries, manual and quick-text modes, board preview, set loading, weighted probabilities elsewhere, and Zoom verbal control. No asset has baked-in labels or fake buttons. Labels, keyboard focus, hover/disabled states, input values, and click handlers remain in the DOM.

## App CSS insertion order

Load `/match-illustrated-v2.css?v=2` **after** `/match-pixel-teacher-art-v1.css?v=1` in the `server.py` teacher HTML response. Earlier MATCH CSS still defines layout and fallback. The new stylesheet only overrides image skins and a few safe spacing values.

## Expected results

- Illustrated, glowing MATCH title/hero panel with existing logo.
- Genuine graphical skins for Image Set / Pair Builder / Quick Text tabs, selected/hover states, Upload/Save/Launch buttons, empty gallery, and number tiles.
- Distinct primary green Save & Launch control, blue supporting controls, red destructive controls, and visibly muted disabled controls.
- Interactive content over the images. No stretching of student images; image thumbnails remain `object-fit: contain`.
- Layout remains functional on a 1280–1600 px teacher display and when teacher views are opened separately.

## Release precautions

1. Keep Railway persistent `/data` mounted. Do not clear the database, caches holding teacher decks, or student/lobby state.
2. Add new *allowlisted* SVG/PNG asset routes only; do not expose arbitrary repository filesystem paths.
3. Use isolated browser test data. Never reset the live classroom from a test.
4. Verify image requests are HTTP 200, CSS computed `background-image` actually resolves, image completeness, action button counts, disabled states, and no JS console errors.
5. Ensure GitHub Actions and Railway complete successfully before claiming deployed.

### Design source

The concept art is an aesthetic target; its baked-in content **must not** be used as a live page background. Standalone transparent graphics deliberately contain no user data, activity content, or text.
