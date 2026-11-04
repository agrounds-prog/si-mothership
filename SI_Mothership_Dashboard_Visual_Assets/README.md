# SI Mothership — Approved Dashboard Visual Asset Pack

Source: approved November 4, 2026 dashboard concept art (1842 × 854 PNG).

## Contents
- `reference/approved_dashboard_concept.png` — full design reference; **not** a drop-in background behind the current dashboard, because it already includes illustrated controls, sample text, and a sample QR code.
- `navigation_tiles/` — 9 full illustrated navigation-button tile crops including printed labels and frames.
- `navigation_icons/` — 9 soft-transparent icon crops to overlay inside the existing functional navigation buttons; best starting point when keeping button size, layout, accessibility and text unchanged.
- `activity_tiles/` — 9 full illustrated activity-shortcut tile crops.
- `activity_icons/` — 9 soft-transparent icon crops for the existing activity shortcut buttons.
- `details/` — supplemental design/reference crops (header, roster, alerts, screen, side scenery, astronaut).

## Required implementation rules
1. Preserve the current Dashboard DOM, behavior, event handlers, keyboard focus, session/roster state, buttons and activities; replace icon visuals and polish CSS only.
2. Start with `navigation_icons/` and `activity_icons/`, sized with `object-fit:contain` or `background-size:contain`, and keep **live HTML labels** (don't duplicate the printed labels from tile crops).
3. The transparent icon versions are soft-feathered crops of a single composite illustration; they are not individually redrawn/isolated vector artwork. Review each over your button background; additional retouching may be needed before production.
4. Use `navigation_tiles/` or `activity_tiles/` only if a button is deliberately skinned with a complete tile. The text is baked into those tile images and should not appear twice.
5. The example join code `369N`, pupil count, QR graphic, class name, URL, activity labels, and alerts in the concept art are illustrative only. Render ALL session details and QR codes dynamically from the existing app.
6. Do not use `bridge.jpg` for the login. Preserve the approved separate PIN-code login PNG and the existing secure login implementation.
7. Do not render the whole reference PNG as a live background behind existing panels: this would repeat buttons, dashboard panels and QR codes, recreating the layering problem.
8. Keep persistent Railway `/data`, current server authorization, classroom lobby, student companion and existing game functionality unchanged.

## Suggested repository location
Upload the ZIP contents into `assets/dashboard-visual-overhaul/` on GitHub; update the dashboard CSS to reference individual PNG paths. Do not replace `index.html` with the image or change the server storage routes.
