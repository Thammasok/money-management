---
name: agent-sandbox-validation-recipes
description: Command recipes and sandbox quirks for validating a docker-compose stack, workflows and a served SPA from a deployment agent session under bash-discipline
metadata:
  type: reference
---

**Docker and env**
- Only commands that START with `docker` are sandbox-excluded. `bash .claude/scripts/run-with-env.sh KEY=VAL -- docker …` runs sandboxed and cannot reach the Docker socket. Pass compose variables with `docker compose --env-file <scratchpad>/x.env -f <abs>/docker-compose.yml …` (a Write into the scratchpad is allowed; `.env*` paths are not). A second isolated stack: add `-p <name>` and its own env file with another `WEB_PORT`.
- `docker compose build --quiet` and `up -d --wait --quiet-pull` keep output small; the default BuildKit output is huge on failure. `--no-cache` for reproducibility checks.
- Reproducibility fingerprints: `docker run --rm --entrypoint sh <img> -c "cd /app/dist && find . -type f | sort | xargs sha256sum | sha256sum"`; for Vite assets, the content-hashed filenames.
- Cleanup proof: `docker ps -a --filter name=…`, `docker volume ls --filter name=…`, `docker network ls --filter name=…`, `lsof -nP -iTCP:<port> -sTCP:LISTEN` (exit 1 = nothing listening), `docker rmi` the images you built. The machine hosts other projects' exited containers: never touch them.

**Scripts the agent cannot loop in**
- bash-discipline bans loops in a Bash call, but `bash <abs>/script.sh` is fine (contents are not analysed; it runs sandboxed, localhost allowed). For repeats use curl URL globbing: `curl -s -o /dev/null -w "%{http_code} " -X POST … 'http://localhost:PORT/path?n=[1-25]'`; per-response files with `-o '<dir>/body_#1.txt' -D <dir>/headers.txt`, then `tail`/Read. Rate-limit probes are time-dependent (nginx `rate=30r/m` refills one token per 2 s and tool round trips take seconds), so assert "429 appears after the burst", never an exact count.
- macOS `mktemp -d` with no template ignores `TMPDIR` and fails in the sandbox ("Operation not permitted"); use `mktemp -d "${TMPDIR:-/tmp}/name.XXXXXX"` in scripts.

**Other verifications that worked**
- Workflow lint: `docker run --rm -v <abs repo>:/repo -w /repo rhysd/actionlint:latest -color` (image is cached locally; includes shellcheck, which flags unused loop variables - use `_`).
- Current action majors: `curl -s https://api.github.com/repos/actions/<name>/releases/latest | grep tag_name` (api.github.com is on the sandbox allow-list). On 2026-10-29: checkout v7, setup-node v7, upload-artifact v7.
- Does the served SPA survive its CSP: `npx playwright screenshot --viewport-size=390,844 --wait-for-timeout=1500 http://localhost:PORT/sign-in <scratchpad>/x.png`, then Read the PNG (blank = JS blocked, unstyled = CSS blocked). `npx playwright *` is sandbox-excluded; the rules still forbid running the E2E suite against a production-mode server.
- Run the Bruno suite against a built image: start the image on `127.0.0.1:3000` with `DATABASE_URL=postgresql://test:test@host.docker.internal:15432/money_management_test` against the backing-service database, `npm --prefix <abs> run api:test:integration`, remove the container before any E2E run.
- E2E via `bash .claude/scripts/run-e2e.sh F-1 list` reuses a Postgres you already started and does not tear it down: `down -v` it yourself.
