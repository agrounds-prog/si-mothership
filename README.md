# SI Mothership v44.3 — Testable Preview + Hosted Build

## Fastest test inside ChatGPT
Open `index.html` with the preview/play control. Teacher key: **5030**.

In **PREVIEW TEST MODE**:
- **Open Test Student** opens a synchronized student window.
- **Launch 2nd Screen** opens a synchronized shared-display window.
- The Lobby displays a real scannable QR containing the test class code **7K3M**.
- Teacher/student/shared state syncs with BroadcastChannel + browser storage; no backend is required.
- The preview QR contains the class code (not a public phone URL), because a ChatGPT preview is not a public classroom host.

For real phones/tablets, run the included server locally or deploy the package. Server/hosted mode automatically uses the real student URL in the QR code.

## v44.2 login compatibility

Teacher key: `5030`. Hosted/server mode authenticates on the server. Standalone preview mode accepts 5030 locally so ChatGPT/file previews do not falsely report an incorrect key when no API server is present.

# SI Mothership v44 — Railway Ready

This package extends v43 with Railway-specific public-domain detection, a Railway health-check configuration, and a documented persistent `/data` volume setup. See `RAILWAY_DEPLOY.md`.

# SI Mothership v43 — Hosted Ready

v43 keeps the full v42 classroom feature set and prepares Mothership for the first public HTTPS / multi-network classroom test.

## Current Mothership feature set

- Teacher Access using a login key
- real classroom join codes and session IDs
- customizable 24-avatar roster sets
- Live Roster / Ready / Raise Hand / Buzz / Help / Picture Prompt
- Photo Inbox large viewer, Save Photo, Delete, Clear All
- Agenda text/image/YouTube
- SI+
- MINEFIELD
- VECTOR
- BOARD with line thickness
- ORBIT
- PIXEL REVEAL with accepted answers and teacher correctness override
- second-screen QR/student-login display
- reconnect/session reliability work from v42
- persistent teacher library and classroom runtime

## What changed in v43

### Hosted public URL support
The server now understands reverse-proxy HTTPS headers and can generate student, QR, second-screen, and WebSocket URLs from the real public domain.

You can also force a public origin with `PUBLIC_BASE_URL`.

### Server-authenticated Teacher Access
The teacher key is no longer the browser's source of authority. `/api/teacher/login` validates the key on the server and issues an HttpOnly teacher session cookie.

Teacher-owned API writes and the authoritative teacher WebSocket now require teacher authentication.

### Teacher library privacy
Unauthenticated/student clients no longer receive the whole saved teacher library. Student join pages receive only the avatar assets / roster-set data they need.

### Hosted persistence path
Set `MOTHERSHIP_DATA_DIR` to a persistent host volume. Mothership stores `mothership_data.sqlite3` there.

### Deployment files
Included:

- `Dockerfile`
- `requirements.txt`
- `Procfile`
- `render.yaml`
- `.env.example`
- `HOSTED_DEPLOY.md`

## Local Windows test

1. Close any older Mothership server window.
2. Unzip the whole folder.
3. Double-click `start_windows.bat`.
4. Enter teacher key `5030`.
5. Use Test Student or the second-screen QR as before.

Local behavior remains compatible with the v42 LAN workflow.

## Hosted test

Read `HOSTED_DEPLOY.md`.

The important hosted acceptance test is: teacher laptop on one network + student phone on cellular/another network + HTTPS public URL + live roster/app synchronization.

## Data file

By default locally:

`mothership_data.sqlite3`

On a host, point `MOTHERSHIP_DATA_DIR` at its persistent volume/disk.

## Architecture boundary

v43 remains a single-teacher/single-live-classroom service. It is appropriate for a real hosted pilot, but it should not be horizontally scaled while using the current SQLite + in-process WebSocket state model.
