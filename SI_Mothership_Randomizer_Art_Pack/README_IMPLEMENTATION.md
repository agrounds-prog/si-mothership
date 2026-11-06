# SI Mothership — Randomizer Artwork Pack

**A complete source art pack for the four approved Randomizer concept screens.** This pack contains editable/resizable SVGs, ready-to-serve PNGs, four mode preview images, and the original approved concept references.

## Use these files in the app

| Mode / purpose | File | How to implement |
|---|---|---|
| All four shared-screen modes | `assets/backgrounds/{wheel,slot,lottery,cards}_bridge_bg.webp` (or `.png` / `.svg`) | Set as the full presentation stage background with `background-size: cover`. Leave live content above it. |
| Shared screen chrome | `assets/overlays/shared_display_hud.svg` | An optional decorative overlay on the stage (`pointer-events:none`), behind the live draw UI. |
| Wheel edge | `assets/components/wheel_rim_overlay.svg` | Overlay **above the live Canvas wheel** to create dimensional gold metal. Do not replace the actual probability slices. |
| Pointer | `assets/components/wheel_pointer.svg` | Position on top of the wheel with CSS. Pointer stays fixed while Canvas rotates. |
| Slot machine | `assets/components/slot_machine_chassis.svg` | Decorative machine frame. Place editable/live animated reel text inside the clear center, not inside the image. |
| Lottery machine | `assets/components/lottery_machine_frame.svg` | Decorative bowl/platform behind **live lottery balls**; live selection remains in JS. |
| Lottery ball | `assets/components/lottery_ball_blank.svg` | Use as each ball background. Overlay live name/number text on top. |
| Mystery Cards | `assets/components/mystery_card_back.svg`, `mystery_card_face_blank.svg` | Back art and reveal art. Apply live names to card faces only at reveal. |
| Winner result | `assets/components/winner_plaque_blank.svg` | Make a decorative border behind the existing `#result` dynamic text. |
| App launcher icon | `assets/components/randomizer_app_icon.svg` | Illustrated wheel artwork for Activities card and optional home shortcut, no extra nested box. |
| Teacher studio frame | `assets/components/teacher_studio_panel.svg` | Scalable translucent panel border behind teacher inputs. Never bake inputs into an image. |
| Four launch tiles | `assets/mode-thumbnails/{wheel,slot,lottery,cards}_mode_tile.webp` | Illustrated art for mode-picker buttons. The previews have example labels; they must **not** replace the real selection renderers. |

## Installation in GitHub

1. Unzip the package.
2. Upload the **`assets/` directory** to `agrounds-prog/si-mothership`, for example at `public/randomizer-art/` or another static-served path. Do not upload directly into a build directory that isn't served by `server.py`.
3. Use `asset_manifest.json` to map all file names. Add cache-busting versions when updating.
4. Ensure the static route actually serves the asset path (the supplied path is only an example), then integrate each art asset as a visual layer in `randomizer.html` — keep the existing saved sets, `pick()`, weighted probabilities, and BroadcastChannel teacher-to-Zoom sync.
5. Use `/randomizer?display=1` to compare the teacher and shared views. Test all modes with short names, long names, 30+ options, weighted picks, and Remove Winner.
6. Retain `/data` and all existing saved classroom libraries during deployment.

### Recommended layering

```css
.randomizer-stage {background: #06142c url('/randomizer-art/backgrounds/wheel_bridge_bg.webp') center/cover no-repeat;}
.randomizer-stage .hud-art {position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
.randomizer-stage .visual {position:relative;z-index:2;}
.randomizer-stage .winner-plaque {position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
.randomizer-stage .winner-text {position:relative;z-index:1;overflow-wrap:anywhere;}
```

## Important production notes

- **All main illustration frames are blank.** Their content must stay live HTML/Canvas because teacher choices, probabilities, and winner names are dynamic.
- `.svg` files support sharp resizing and custom overlays. `.png` versions are included for fast previewing or systems without SVG support.
- All backgrounds are 16:9, designed for the user's Zoom shared screen. `background-size:cover` is appropriate for backgrounds, never for the Canvas wheel or live word content.
- The screenshots under `references/` are **concept art only**, not user interfaces to insert as-is.
- Mode tiles are supplied as imagery for teacher selection menus; the illustrative example words shown in some thumbnails are not actual selected classroom choices.
