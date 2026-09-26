# SI Mothership v44 — Railway deployment

This build is prepared for a single Railway web service with WebSockets and a persistent SQLite volume.

## Required service settings

1. Deploy this folder as a Railway service.
2. Add a persistent Railway Volume mounted at `/data`.
3. Set these variables:
   - `Teacher login key is fixed to `5030` in this pilot build.
   - `MOTHERSHIP_DATA_DIR=/data`
   - `MOTHERSHIP_NO_BROWSER=1`
4. Generate a Railway public domain for the service.
5. Railway supplies `PORT` and `RAILWAY_PUBLIC_DOMAIN`; Mothership uses them automatically.

## Health check

Railway should check:

`/api/health`

A healthy response contains `"ok": true`.

## Persistent data

`/data/mothership_data.sqlite3` contains the teacher library and current runtime. Keep the volume attached across deployments.

## Important deployment rule

Run **one application replica** while Mothership uses SQLite and an in-process WebSocket client registry. Horizontal scaling should wait until session/pub-sub state is moved to a shared service such as Postgres + Redis.

## First public test

1. Open the Railway public domain on the teacher laptop.
2. Sign in with the configured teacher key.
3. Start a new session.
4. Launch the second screen and verify its QR points to the Railway HTTPS domain.
5. Turn Wi-Fi off on a phone so it is using cellular data.
6. Scan the QR and join the class.
7. Confirm the student appears in Live Roster.
8. Test Ready, SI+, VECTOR, BOARD handoff, Emergency Return, and End Session.

## Backup

Download or back up `/data/mothership_data.sqlite3` to preserve the teacher library.
