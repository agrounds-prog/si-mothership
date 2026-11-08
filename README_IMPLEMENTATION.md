# SI Mothership Randomizer — Textured Art V3

## GitHub upload
Upload the contents of `assets/randomizer-v3/` into the repository under exactly `assets/randomizer-v3/`, preserving the filenames and directory. The files are separate from current production assets and do **not** automatically change the app by uploading alone.

## Integration layers (back to front)

### Cosmic Lottery
1. `lottery_machine_shell.png` — detailed machine shell and glass chamber, behind choice balls. This artwork has glass fill and is **not a transparent cut-out through the chamber**; use the existing transparent center with live items on top and inspect legibility.
2. Live randomized balls — preserve teacher-entered choice text, weighting, shuffle, and state synchronization.
3. `lottery_glass_overlay.png` — perimeter highlights only, overlay above balls; center is transparent. Must not block pointer events.
4. `lottery_ball_blank.png` — ball art for each choice, with real choice text overlaid. The middle is pale; verify text contrast.

### Slot Machine
1. `slot_machine_shell.png` — cabinet with empty dark reel cavity, behind live reels.
2. Live reels, with real selection text.
3. `slot_reel_window_overlay.png` — ornamental glass/reel surround above reels; test geometry rather than covering reel text. This overlay **has a translucent lavender center**, not a completely open hole; adjust alpha / clip if necessary.

### Spin Wheel
1. Live probability wheel stays on canvas (never replace this with static image).
2. `wheel_housing.png` — metallic circular housing, behind/in front of wheel rim as appropriate; the central opening is transparent.

### Mystery Cards
1. `cards_stage_base.png` — holographic stage, beneath the cards.
2. `mystery_card_back.png` — dynamic card backs; do not bake in any labels.
3. `mystery_card_face_blank.png` — faces with live winner text.

### Shared result
- `winner_plaque_blank.png` — background plate for the live result text. Leave text dynamic.

## Important implementation rules
- Do not replace the full live Randomizer interface with concept screenshots.
- Use image layers with `pointer-events:none` where appropriate; retain all buttons, controls, selection behavior, probabilities, saved sets and Zoom synchronization.
- Preserve original image proportions with `contain` and use a shared coordinate system for machine shell + live regions + overlays.
- Test all modes in teacher and separate display views, including long text and 1366×768 / 1920×1080 viewports.
- This package provides **10 finished PNG assets**. The `lottery_inner_glow`, `wheel_pointer`, `wheel_center_badge`, and other optional assets from the earlier proposed specification are **not included**; they should use existing application art until separately created.
- Confirm transparent glass against a dark background; transparent background does not mean the glass itself has an empty interior.
