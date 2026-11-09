# ORBIT — graphics-first concept asset handoff

The new ORBIT visual asset pack was created for upload to this folder. **This README is not the image pack.** The PNG binaries must be added separately from the ZIP before the app can use them.

## Required files
- `00_orbit_full_shared_screen_concept.png` — visual reference; not a runtime background
- `01_orbit_logo.png`
- `02_awaiting_crew_ideas_badge.png`
- `03_transmitted_counter_badge.png`
- `04_question_planet_with_orbits.png`
- `05_response_pod_shell.png`
- `06_footer_banner.png`
- `07_teacher_mission_control_shell.png`
- `08_student_response_terminal_shell.png`
- `09_solar_grouping_chamber.png`

## Implementation brief
Upgrade ORBIT’s teacher, shared-screen, and student views to the approved cinematic spaceship-bridge aesthetic. Integrate the uploaded PNGs as **real artwork** instead of reconstructing them using CSS gradients, while preserving all interactive functionality, keyboard accessibility and responsive scaling. Keep the central discussion prompt, response text, response count, student identities/privacy state, activity rounds, Spotlight and solar-system grouping as real dynamic text/components over the artwork. In particular, never use the full concept screenshot as the complete live interface: use the separate logo, planet, response pod, status and frame images, sized and positioned without stretching. The badge text in the example PNGs must not replace live state; for production, use the art as skins with a dynamic counter/status overlay, or prepare text-free variants. Add ORBIT Studio options for selectable planet colors and styles, keeping selected art consistent in the teacher preview and shared display. Leave student login, saved activities, persistence and multiplayer synchronization unchanged. Verify 24 or more live responses, anonymity, teacher controls, 440×780 student compatibility, and the ORBIT regression suite before deployment.

**Status:** Implementation pending upload of the binary image files.
