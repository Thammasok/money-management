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
- E2E via `bash .claude/scripts/run-e2e.sh F-1 list` reuses a Postgres you already started and does not tear it down: `down -v` it yourself. Before the verifying run `down -v` everything so it cold-starts (self-provisioning) and cleans up after itself; `run-e2e.sh "" list` runs every feature (38 tests in ~22 s on F-2).

**Added in F-2**
- A `docker …` command with a shell redirect (`> file`) is NOT sandbox-excluded: "permission denied while trying to connect to the docker API". Do the filtering inside the container instead. Offline Liquibase check: `docker run --rm --entrypoint sh -v <abs>/db/changelog:/liquibase/changelog:ro -e LIQUIBASE_ANALYTICS_ENABLED=false liquibase/liquibase:4.31 -c "liquibase --url=offline:postgresql --changelog-file=changelog/db.changelog-master.yaml [--contexts=prod] update-sql 2>&1 | grep -E '^-- Changeset|INSERT INTO users'"`.
- `rm -r <dir>` is denied; `rm <file>` works. Keep throwaway trees small, and delete env files holding a password individually.
- No `shellcheck` on the host: `docker run --rm -v <abs>/scripts:/s:ro --entrypoint shellcheck rhysd/actionlint:latest -x /s/smoke-test.sh` (silent = clean); `bash -n` for syntax.
- `docker compose --env-file <scratch>/x.env -f <abs>/docker-compose.yml build --no-cache --quiet` in the background (about 3 minutes), then fingerprint both images (backend `dist` tree hash, web asset names and whole-tree hash) and compare with any earlier build: identical output is the reproducibility proof.
- Rate-limit probes: one `curl` run with several URLs, because tool round trips take seconds and `rate=60r/m` refills a token a second. `-o /dev/null` applies only to the FIRST URL of a group, so later URLs print their bodies; use `--next` to start a new option group per URL. Example: `curl -s -o /dev/null -w "%{http_code} " -X POST -H "Content-Type: application/json" --data "{}" "http://127.0.0.1:18080/api/v1/wallets?n=[1-30]" --next -s -i -X POST … "http://…/api/v1/wallets"` (anonymous requests are counted by the edge before the backend answers 401, so no data is created).
- Authenticated screenshot of the production stack: sign up with `curl -i` to read the `sid`, write a storage-state JSON (`cookies: [{name:"sid", value, domain:"127.0.0.1", path:"/", expires:-1, httpOnly:true, secure:false, sameSite:"Lax"}], origins: []`) into the scratchpad, then `npx playwright screenshot --load-storage=<json> --viewport-size=390,844 --wait-for-timeout=2000 [--full-page] http://127.0.0.1:18080/<path> <png>`; Read the PNG. This is a probe, not an E2E run. Delete the JSON afterwards.
- Bruno against the built image, UTC like CI: `docker run -d --name <n> -p 127.0.0.1:3000:3000 -e DATABASE_URL=postgresql://test:test@host.docker.internal:15432/money_management_test <backend image>`, wait with Monitor on `/api/v1/me` → 401, then `bash .claude/scripts/run-with-env.sh TZ=UTC -- npm --prefix <abs root> run api:test:integration` (runs sandboxed fine, prints about 700 lines for two collections, no way to shorten it without a pipe), then `docker rm -f <n>`.
- The scratchpad is shared by every agent of the session: it already held the stopped run's `prod.env`, burst files and screenshots. List it first (`find <scratchpad> -maxdepth 2`) for useful leftovers and for things to delete at the end.
- `docker images --filter dangling=true` shows other projects' months-old images; only `docker rmi` the tags you built.
- Resuming a stopped deployment run: `git status --porcelain` showed only `checklist.md`, no report, containers `money-management-prod-*` plus the backing-service Postgres and two `f2-validate` images. Tear them down with `docker compose --env-file <env> -f docker-compose.yml down -v` (prod needs the env file even for `down`), then rebuild; do not trust old images.
