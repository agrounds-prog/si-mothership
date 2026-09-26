# Hosted deployment — SI Mothership v43

v43 can run locally exactly like v42, but it is also packaged for an HTTPS web host.

## Required hosted behavior

The host must support:

- Python 3.11+
- WebSockets
- HTTPS
- a persistent writable disk/volume for `mothership_data.sqlite3`
- the host-provided `PORT` environment variable

For the current single-teacher test architecture, one persistent application instance is expected. Do not scale to multiple replicas while using SQLite; replicas would not share live WebSocket memory or the same local database.

## Environment variables

- `MOTHERSHIP_TEACHER_KEY` — teacher login key. Default for local testing is `5030`.
- `MOTHERSHIP_DATA_DIR` — persistent data directory. Local default is the app folder.
- `MOTHERSHIP_NO_BROWSER=1` — disable trying to open a browser on a cloud server.
- `PUBLIC_BASE_URL` — optional. Set to the exact public HTTPS origin if the host does not provide correct `X-Forwarded-Proto` / `X-Forwarded-Host` headers.
- `PORT` — normally supplied by the host automatically.

## Docker deployment

Build and run:

```bash
docker build -t si-mothership .
docker run --rm -p 8877:8877 \
  -e PORT=8877 \
  -e # Teacher key is fixed to 5030 in v44.1 pilot build \
  -e MOTHERSHIP_DATA_DIR=/var/data \
  -v mothership-data:/var/data \
  si-mothership
```

Then open `http://localhost:8877`.

## Render-style deployment

A `render.yaml` blueprint is included. Create a new Blueprint/Web Service from this folder/repository, set the `MOTHERSHIP_TEACHER_KEY` secret, and keep the persistent disk mounted at `/var/data`.

The application uses the host's forwarded HTTPS host/protocol when it builds:

- student join links
- QR codes
- second-screen links
- WebSocket URLs

If those links show an internal HTTP address instead of your public HTTPS domain, set `PUBLIC_BASE_URL=https://your-domain.example`.

## First hosted acceptance test

1. Open the public HTTPS teacher URL.
2. Sign in with the teacher key.
3. Start a fresh classroom session.
4. Open the second screen and confirm the QR code points to the public HTTPS domain.
5. Turn Wi-Fi off on a phone so it is using cellular data.
6. Scan the QR and join the class.
7. Choose an avatar/name and verify the student appears in Live Roster.
8. Test Ready Check, one app launch, Return to Classroom, Emergency Return, and End Session.
9. Restart/redeploy the app and confirm saved teacher library data remains available from the persistent disk.

## Security changes in v43

- The teacher key is validated by the server.
- Successful teacher login creates an HttpOnly teacher session cookie.
- Teacher WebSocket authority requires that authenticated cookie.
- Saved teacher content is not exposed to unauthenticated clients.
- Student clients receive only the public avatar/roster-set subset needed for joining.
- Student and shared-screen links remain tied to the active server session ID.

This is still a single-teacher hosted test architecture. A later multi-teacher/SaaS phase should move persistent data to a shared managed database and split teacher workspaces by account/key.
