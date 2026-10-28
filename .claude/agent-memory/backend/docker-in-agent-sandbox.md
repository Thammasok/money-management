---
name: docker-in-agent-sandbox
description: How to run docker-compose / Liquibase / the backend from an agent session here — sandbox exclusion rules, host-port clashes with the user's other stacks, output-size traps
metadata:
  type: project
---

**Only commands that START with `docker` are sandbox-excluded.** `npm run db:*` (root scripts that shell out to docker) fails inside the sandbox with "permission denied while trying to connect to the docker API". In agent sessions run the `docker compose -f /abs/path/docker-compose.backing-service.yml …` form directly (that is what `db:up` / `db:reset` / `db:down` wrap). `bash .claude/scripts/run-e2e.sh …` is unsandboxed, so Playwright's `resetDb()` → `npm run db:reset` works there. Don't reach for `dangerouslyDisableSandbox` for this.

**The user's machine hosts many other stacks** (`docker ps -a` showed cadence, whalepocket, weave, gh-ing-bruno-isolated, github-ingestion … using host ports 5432, 5433, 3000, 13077, 8080). Never stop, reuse or remove their containers (they are not ours). This project's compose therefore publishes Postgres on host port **15432** (`POSTGRES_PORT` overrides; inside the compose network it is 5432). Backend `DATABASE_URL=postgresql://test:test@localhost:15432/money_management_test`; Jest integration tests read `TEST_DATABASE_URL` only (never `DATABASE_URL`). The backend itself must stay on 3000 (Playwright config) — if 3000 is busy, find out why before starting it.

**Habits that worked:**
- `up -d --wait` exits 0 with the one-shot Liquibase service; its first-pull output is ~50 KB of progress lines — confirm with `docker compose … ps -a` instead of reading it.
- Test Liquibase rollback: `docker compose … run --rm migrations --url=jdbc:postgresql://postgres:5432/money_management_test --username=test --password=test --changelog-file=changelog/db.changelog-master.yaml --contexts=test rollback-count 4` (args replace the service command), then `run --rm migrations` to re-apply.
- Start the backend: `bash .claude/scripts/run-with-env.sh DATABASE_URL=… -- npm --prefix /abs/backend run start:prod` with `run_in_background: true`; wait with Monitor (`until curl … | grep -q 401`); stop with TaskStop and confirm the port is free with `lsof -nP -iTCP:3000 -sTCP:LISTEN` before restarting.
- Bruno: `npm --prefix /abs/root run api:test:integration` (the `ERROR: failed to copy trust settings…` lines are macOS-sandbox noise). `npm run mocks:start` (npm `mb`) leaves `mb.log` in the repo root — delete it.
- Reproduce the Stop unit gate without touching its retry file: `python3 -c "import subprocess; r = subprocess.run(['npx','jest','--no-coverage','--maxWorkers=2'], cwd='/abs/backend', capture_output=True, text=True); print(r.returncode, (r.stdout+r.stderr)[-1500:])"`.
- `docker compose … down -v` skips profile services: after a Mountebank check use `--profile mock down -v` too, or a stopped `money-management-mountebank-1` container lingers.
- zsh globs unquoted `--include=*.ts` in `grep` and errors; pass explicit directories instead (no Grep/Glob tools in the backend agent).
- `ps` is not permitted in the sandbox. To see what owns a port: `lsof -nP -iTCP:3000 -sTCP:LISTEN`, then `lsof -a -p <pid> -d cwd`. Stop your own background server with TaskStop `<task id>` (never `kill`), then re-check with `lsof`.
- **After a usage-limit interruption**, check before anything else: `docker compose -f … ps -a` and `lsof` on 3000/15432/2525/4545/5173. A backend started earlier keeps serving a STALE build — stop it and rebuild before trusting any result. A leftover Postgres container of ours can simply be reused.
- Monitor and TaskStop are deferred tools: load them once with `ToolSearch select:Monitor,TaskStop`. Readiness wait = Monitor on `until curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/v1/me | grep -q 401; do sleep 1; done; echo ready` (and `…/imposters/4545` → 200 for Mountebank). A quick `curl` after the notification is a cheap double-check; do not arm throwaway Monitors.
- One Bruno folder: `npm --prefix <root> run api:test:integration:F-2 -- 02-walking-skeleton` (npm appends the path). A full run prints ~350 lines per collection — unavoidable, budget for it (3–4 full runs per feature).
- `npm --prefix backend run format` rewrites only files that differ (safe); run it, then `format:check`.
- Jest integration specs share ONE persistent database across runs: never use fixed ids or emails (a failed first run leaves rows that break the re-run). For ordering tie-break tests use `randomUUID().slice(0, 35) + '1' | '2' | '3'`.
- Nest logs a rejected oversized body (413) as ERROR with a stack — silence it inside the one test: `jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)`, restore right after the Act.
- `process.env.TZ = 'Asia/Bangkok'` assigned at runtime works on Node 26 for timezone tests (restore in `afterEach`).
- Editing a YAML *comment* in an applied Liquibase changeset does not change its checksum (`run --rm … migrations` → "Previously run: N, Run: 0").
- A fresh `docker compose down -v` + `up -d --wait` cycle takes ~20 s and the images are cached; do the "wipe and run again" repeatability check for real rather than reasoning about it.
