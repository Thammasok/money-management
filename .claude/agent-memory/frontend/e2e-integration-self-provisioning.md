---
name: e2e-integration-self-provisioning
description: Why the root playwright.config.ts brings up its own Postgres + backend in integration mode, and what that means for the Stop-time e2e-gate and teardown
metadata:
  type: project
---

The Stop hook `e2e-gate.py` re-runs `bash .claude/scripts/run-e2e.sh <feature> list` (plus a full-regression pass when `.claude/.vibe-active` is absent) AFTER the agent has stopped — but the orchestrator also asks the agent to tear down every server/container it started. Both can only hold if the E2E run is **self-provisioning**, so F-1 added (runner wiring, no assertion touched):
- `e2e/global-setup.ts` — integration mode only: `docker compose -f docker-compose.backing-service.yml up -d --wait`; returns a teardown that runs `down -v` **only if this run started Postgres** (`ps --status running -q postgres` before). Inert when `E2E_MODE=mock`.
- a second `webServer` in `playwright.config.ts` (integration only): `npm --prefix backend run build && npm --prefix backend run start:prod` with `DATABASE_URL=…@localhost:${POSTGRES_PORT ?? 15432}/money_management_test`, readiness URL `/api/v1/me` (Playwright treats 401 as up). `reuseExistingServer: true`, `NODE_ENV` left unset (production would mark the cookie `Secure`, dropped on http).
Result: a cold run takes ~14 s for 16 specs, leaves no container, volume or listener (verified with `docker ps -a`, `docker volume ls`, `lsof`). A harmless `Idle database client failed: terminating connection` backend log appears at teardown (the DB is removed before Playwright kills the backend; the pool has an error listener).

**How to apply:** later features extend `db-reset.ts` contexts, not this wiring. If a feature needs another real dependency in integration mode, add it to `global-setup.ts`/`webServer` rather than asking the next agent to start it by hand. Never leave a manually started stack running past the Stop — the gate provisions its own. For a manual debug stack: `docker compose -f … up -d --wait`, backend via `run-with-env.sh DATABASE_URL=… -- npm --prefix backend run start:prod` (background, wait with Monitor on `/api/v1/me` → 401), then TaskStop + `down -v`.
