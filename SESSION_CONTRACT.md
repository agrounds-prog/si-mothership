# SI Mothership — Classroom Session Contract (v43)

## Session

A running classroom has:

- `session_id` — server-generated opaque ID
- `join_code` — 4-character student code
- canonical classroom state — persisted by the server
- teacher library — persistent data stored separately from the temporary class session

Creating a new session rotates both `session_id` and `join_code`, clears runtime classroom state, and disconnects stale student/shared-screen clients.

## Roles

### Teacher
Teacher authority now requires a server-authenticated Teacher Access session. The login key is checked by `/api/teacher/login`; a successful login receives an HttpOnly teacher cookie. Teacher API writes and the authoritative teacher WebSocket require that authentication.

The teacher remains authoritative for classroom-wide state: screens, prompts, app launch/exit, app settings, reveal controls, roster management, session reset, photo deletion, etc.

### Student
A student browser has a session-scoped student token and avatar/name identity. The server merges only that student's own classroom contributions into canonical state rather than accepting the student's whole snapshot as authoritative.

Student clients receive only the teacher-approved public avatar / roster-set storage needed for joining, not the teacher's full saved library.

### Shared Screen
View-only. It receives canonical classroom state and never writes classroom state.

## Student merge surface

Student-owned changes currently include:

- own roster response fields
- own Buzz/Help/Hand state
- own photo submissions
- own SI+ answers
- own VECTOR response
- own ORBIT response
- own PIXEL REVEAL guess
- own BOARD ink while granted BOARD control
- active-Navigator MINEFIELD move state

## Reconnect

The student browser stores a small session identity record:

`join code + session id + student token + name + avatar key`

On refresh/reconnect, it looks for the same token in the canonical roster and resumes that student identity. It does not create a duplicate student.

## Presence

Student WebSocket disconnect/reconnect sends transient presence events. The teacher UI may mark the roster entry as reconnecting without deleting the student from the roster.

## URLs and HTTPS

The server exposes current session data through:

- `GET /api/session/info`
- `GET /api/join-check`
- `GET /api/qr`
- `GET /ws`

Student and shared-screen URLs include `sid=<session_id>` so stale URLs can be rejected after session rotation.

On a hosted service, Mothership derives the public HTTPS origin from forwarded host/protocol headers. `PUBLIC_BASE_URL` can explicitly override this when needed. Browser WebSockets automatically use `wss://` on HTTPS pages.

## Persistence

SQLite file: `mothership_data.sqlite3`

Its location is controlled by `MOTHERSHIP_DATA_DIR`. Hosted deployments must point that directory at a persistent disk/volume.

Persistent teacher-library keys are stored separately from the current classroom runtime snapshot.

## Scaling boundary

v43 is a single-teacher/single-live-classroom hosted pilot architecture. SQLite persistence and in-process WebSocket state assume one application replica. Multi-replica or multi-teacher deployment should move live coordination and persistent workspaces to shared infrastructure first.
