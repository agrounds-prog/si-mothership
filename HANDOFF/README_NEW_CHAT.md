# SI Mothership — New Chat Handoff

This package was generated on 2026-09-29 from the canonical GitHub repository.

## Canonical source
- Repository: agrounds-prog/si-mothership
- Branch used for product development: main
- Exact source SHA: 55745fb25b2055212e95d3beb531774b419a1390
- Release: SI Mothership v52.0 — Visual System Refresh
- index.html blob: e34df2b23c6f183f623f8e48bc1577b0de6e6762
- server.py blob: bc78d383aa1a340773b6fc005129571539f51432
- Release gate blob: 75ace4ecb49f422b0825aa469bffcd7e14f03400

## Production
- Railway project: SI Mothership
- Environment: production
- Service: mothership-web
- Domain: https://mothership-web-production.up.railway.app/
- Pinned production SHA: 55745fb25b2055212e95d3beb531774b419a1390
- Latest successful deployment: 5a30acc3-4356-470a-be5b-6302ff1f5059
- One replica in SFO
- Volume mounted at /data
- Start command: python server.py
- Healthcheck: /api/health
- Railway staged changes: none

## How to continue in a new chat
1. Treat the repository source at the SHA above as canonical.
2. Read HANDOFF/CURRENT_STATE.md and HANDOFF/PROJECT_HISTORY.md.
3. Use GitHub connector for source changes and Railway connector for deploys.
4. "Proceed" means implement hands-on, run the release gate, commit, deploy exact SHA, pin Railway, verify SUCCESS/health/staged=null/pendingWork empty.
5. Do not revert to older prototypes or stale ZIP snapshots.
6. Preserve privacy/sync boundaries and STARWHEEL/Sketch invariants described in CURRENT_STATE.md.

## Transcript note
HANDOFF/PREVIOUS_CHAT_RECONSTRUCTION.md is a detailed reconstruction from retained conversation context and project summaries. It is not a platform-generated verbatim ChatGPT data export.
