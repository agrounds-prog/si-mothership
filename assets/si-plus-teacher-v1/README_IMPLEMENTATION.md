# SI+ Teacher Navigation Art Pack V1

**Target:** GitHub `agrounds-prog/si-mothership`, branch `main` (SI+ within Mothership; not the standalone SI+ project).

## Contents
- `backgrounds/`: **four individual text-free teacher-page backgrounds**, each supplied as optimized WebP and PNG, plus alternate styling. Page mapping: `si_home`, `presentation_library`, `ready_to_start`, `presentation_builder`.
- `panels/`: **six transparent decorative frames** for optional panels and selected states.
- `buttons/`: **eight blank textured PNG button skins**. Text and click behavior must remain real DOM nodes; no embedded labels.
- `branding/`: SI+ emblem (SVG + transparent PNG).
- `icons/`: 26 reusable line icons (SVG + transparent 96 px PNG).
- `references/`: four fully composited concept illustrations, visual reference **ONLY** (contain decorative simulated text/buttons; do not place as interactive UI backgrounds).
- `implementation/si-plus-teacher-assets.css`: **starter optional CSS**, intentionally not wired to app selectors until the SI+ DOM is examined.

## Apply in GitHub
1. Upload the files **under `assets/si-plus-teacher-v1/`**, preserving subdirectories.
2. Ensure the app's asset-serving mechanism can resolve these paths (existing static route vs. server explicit allowlist). Do not assume uploaded GitHub paths automatically serve as URLs.
3. Map the `backgrounds/` files to the **correct teacher screens** without replacing live forms, buttons, status labels, or text. Prefer positioning page art behind readable translucent DOM cards, at `background-size:cover` and center.
4. Optional panel/button skins should be used as **background images of existing clickable elements** or `::before` layers (`pointer-events:none`), with text/ARIA/events layered on top. For highly stretchable panels, use CSS borders/gradients rather than distorting ornamental PNG corners.
5. Keep editable presentation title, saved deck management, slide types, multi-image upload, media, library, live/activity controls, and in-progress local drafts unchanged.
6. Make danger button red, Preview mint, Save green, Create/Start cyan. Avoid treating 'Progress Paused' as a primary action.
7. Test 1366x768, 1440x900, 1920x1080; ensure no header/button is lost to overflow or horizontal scroll; test keyboard navigation and reduced motion.
8. Verify Railway deploy `SUCCESS`, existing `/data` volume, saved presentations, Lobby and active presentation transition remain intact.

## Asset vs functionality boundaries
Art alone cannot recreate the concept. Final polished UI requires CSS spacing, reliable responsive layout, proper button grouping, and live DOM overlays. The reference screens are **mockups**, not application screenshots, and no GitHub code was modified by this ZIP creation.
