# Mothership Quick Poll — integrated first release

Based on the concept images and build brief supplied 2026-10-10.

## Implemented
- Uses existing Mothership teacher login, session ID, join code, and student roster tokens.
- Teacher Quick Poll launcher, question composer, 2–6 choices with optional uploaded/compressed pictures.
- Single choice, multiple-choice limits, vote-change option, and 15-second to 5-minute timer.
- Anonymous by default. Identified response breakdown is accessible only to the teacher.
- Sensitive check-ins force anonymous and hidden results; projector suppresses counts for groups with fewer than five votes.
- Teacher template library and ready-to-use prompts for understanding, emotions, predictions and scales.
- Student phone/Chromebook voting, vote confirmation and recovery after reconnect.
- Shared-screen image leaderboard, bars, donut chart and two-choice showdown.
- Open/close, live/hidden results, change display, revote with before/after tally, and dismiss to restore the prior game.
- Server-side vote validation and deduplication in the existing Railway SQLite volume.

## Session and privacy
Runtime polls and vote rows are cleared on New Session. Saved templates remain.
Vote rows use salted HMAC keys instead of raw student names or tokens.
Anonymous votes are never sent with identities to any client.
Small sensitive groups do not get public aggregate counts.
The existing classroom activity state, stored boards, and games are not modified.

## Future phases from the full concept
Prompt sequences and favorites; teacher image library picker/crop; explicit-safe avatar groups;
snapshot/export, richer histories, ranking, moderated written responses and animation polish.

## Classroom test
Open Quick Poll from the teacher page. Launch a poll while another game is paused or running.
Join from the normal student URL and show the normal shared-screen URL.
Vote on two devices, switch result displays, close/reveal, revote, then dismiss.
Verify the prior game returns with progress intact. Test private check-ins with a small group.

Architecture note: Railway and the existing SQLite store are deliberately retained instead of Supabase.