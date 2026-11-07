# SI Mothership Randomizer — Concept Art V2 (GitHub implementation pack)

This package includes four approved **new 16:9 concept images**, plus implementation assets that have **no baked-in classroom choices or results**. The concept images are references only; they must not be used as entire user interfaces.

## Upload to GitHub

1. Extract the ZIP.
2. Open `agrounds-prog/si-mothership` on branch `main`.
3. Upload the folder **`SI_Mothership_Randomizer_Art_Pack/assets/`** preserving the path. It is compatible with the app’s existing `/randomizer-art/{category}/{filename}` routes; overwrite the existing art files when prompted.
4. Commit changes.
5. Integrate/adjust CSS in `randomizer.html` only after assets are present; preserve JS selection and sync code.
6. Confirm Railway deployment, verify URLs, and hard-refresh the app.

## Key art files

| Category | Asset | Usage |
|---|---|---|
| backgrounds | `{wheel,slot,lottery,cards}_bridge_bg.webp` | New 1920×1080 space-station scene backgrounds, no UI text |
| components | `wheel_rim_overlay.svg`, `wheel_pointer.svg` | Transparent metallic wheel rim and pointer; keep the live rotating Canvas underneath |
| components | `slot_machine_chassis.svg` | Metallic slot cabinet; preserve live 3-reel UI inside the window |
| components | `lottery_machine_frame.svg`, `lottery_ball_blank.svg` | Glass chamber + individual dynamic ball elements |
| components | `mystery_card_back.svg`, `mystery_card_face_blank.svg` | Front and back art; overlay real result text dynamically |
| components | `winner_plaque_blank.svg` | Empty prize plaque; overlay HTML text |
| components | `stage_pedestal_blank.svg` | Optional new transparent gold/cyan stage support beneath a machine; requires adding to static route allowlist |
| mode-thumbnails | `{wheel,slot,lottery,cards}_mode_tile.webp` | Teacher selection thumbnails only; may contain sample labels |
| overlays | `shared_display_hud.svg` | Decorative transparent HUD, behind active buttons/text |
| references | `{wheel,slot,lottery,cards}_approved_concept.png` | New full-quality concept art, for visual comparison only |

The pack retains the prior implementation-ready icon and Teacher Studio panel assets so nothing else becomes missing after overwrite. PNG renderings accompany most component SVGs.

## Important integration details

- **Wheel:** Do not flatten the wheel illustration into a PNG; the four wedges and probabilities are live Canvas sectors. Use the separate transparent rim art and dynamic labels.
- **Lottery:** Ball count, animated positions, selection, and winner should remain live DOM with choice IDs; never use the sample ball labels in concept art.
- **Cards:** Card backs and faces are editable/animated elements, not screenshots.
- **Slot:** Preserve 3 independent reel elements and winning selection text.
- **Live text:** Any concept sample phrases are examples, not production labels.
- **Screen sizes:** Test 1366×768, 1580×900, 1920×1080 and `/randomizer?display=1`. Avoid cropping the winner plaque and Randomize button.
- **Data:** Do not change the storage key `siMothership.randomizerSets.v1`, the nine app shortcuts, the classroom lobby, or `/data` volume.

### Compatibility note
Existing asset names and route structure are preserved. The optional `stage_pedestal_blank.svg` needs a single allowlist addition on the server before use.
