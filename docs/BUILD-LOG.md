# Money Management — Build Log

Durable, append-only history of how each feature was built: test-count reconciliation, schema changes, CI/CD changes, contract disputes, and commit references. `README.md` states only what is true now; what changed and why lives here. One entry per feature, most recent last.

## Feature History

### F-1: Sign Up and Sign In

Walking-skeleton feature (2026-10-28 to 2026-10-29), branch `feat/F-1`, run autonomously by the vibe pipeline: pre-dev, backend, frontend, deployment tracks.

**Test-count delta and the math.** Greenfield, so every test is new and the prior total is zero.

| Suite | Tool | Added | Measured |
|---|---|---|---|
| Backend unit | Jest 30 | 115 tests / 11 files | 2026-10-29, Node 24.22.1 container (`npm test`) |
| Backend integration (real Postgres) | Jest 30 + Supertest | 36 tests / 2 files | 2026-10-29, Node 24.22.1 container against the seeded test database (`npm run test:int`) |
| Frontend unit and component | Vitest 5 | 100 tests / 15 files | 2026-10-29, Node 24.22.1 container (`npm test`) |
| API contract | Bruno 4.3 | 44 requests, 53 tests | 2026-10-29, run against the **built backend image** on the seeded test database |
| End to end | Playwright 1.64 | 16 tests / 4 files | 2026-10-29, `bash .claude/scripts/run-e2e.sh F-1 list` |

115 + 36 + 100 + 16 = 267 test cases, plus the 53 Bruno tests. The earlier tracks reported the same numbers (backend 115 + 36 and Bruno 44 / 53 on 2026-10-28; frontend 100 and Playwright 16 on 2026-10-29), so nothing was added or lost during deployment. One deliberate mismatch with the pre-dev baseline: `mocks/identity-api.inject.js` was corrected in the backend track to answer 415 to a non-JSON body, like the real service; no assertion changed.

**Schema and migrations.** Tables `users`, `sessions`, `sign_in_attempts`. Changesets `F-1-001-create-users`, `F-1-002-create-sessions`, `F-1-003-create-sign-in-attempts` (no context: run everywhere) and `F-1-004-seed-test-user` (context `test`). No renumbering. All four were rolled back and re-applied in the backend track.

Production runs Liquibase with `--contexts=prod`, **not** with an empty filter as the deployment stage template suggests. Evidence (Liquibase 4.31.1, offline `update-sql` over the real changelog, 2026-10-29): with no `--contexts` the output includes `INSERT INTO users … 'seed.user@example.test'` (a known-password account); with `--contexts=prod` only 001 to 003 are emitted. On a real database the second migration run reports "Run: 0, Previously run: 3, Filtered out: 1 (Context mismatch)". `scripts/smoke-test.sh` asserts that the seed User cannot sign in, and was shown to fail when the migration ran with `LIQUIBASE_CONTEXTS=test`.

**CI/CD changes.** New `.github/workflows/ci.yml` with jobs `backend`, `frontend`, `integration` and `images`; no `continue-on-error` anywhere. No deploy job: hosting, registry and credentials are not defined by the plan (see `artifacts/F-1/10-deployment-report.md`, hand-offs H-1 and H-2). Deployment artifacts added: `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx/` (edge configuration), `docker-compose.yml`, `.env.example`, `backend/.env.example`, `scripts/smoke-test.sh`, `.gitignore` entries for `.env` files.

Node is pinned to **24.22.1** (LTS) in both Dockerfiles and CI rather than 22: the lockfiles were written by npm 12 on Node 26, and the npm 10 that ships with Node 22 refuses `backend/package-lock.json` with "Missing: webpack@5.112.2 from lock file". `npm ci --dry-run` passes on Node 24's npm 11.19.1 for both lockfiles. Node 26.9 (the developer machine) is not an LTS release.

**Contract Disputes.** None raised in any track. Nothing under `e2e/` or `collection/` was modified by the deployment track.

**Verification of the release artifact (2026-10-29).** Two from-scratch image builds produced identical backend output (tree hash `36ec14ac…`) and identical web asset names (`index-C8sK9Byi.js`, `index-DMfIuhCZ.css`). The production stack came up healthy on the first attempt; the smoke test passed 11 of 11; the edge rate limit, the pass-through of the backend's own 429 with `retryAt`, runtime re-resolution of the backend address, graceful SIGTERM shutdown (exit code 0), and data surviving `docker compose down` / `up` were each exercised against the running stack.

**References.** Pre-dev `79504b6`, backend `2d44085`, frontend `34ea102`, all on `feat/F-1`; the deployment track's commit is made by the main session. The PR to `main` and the merge into `develop` are pending: `develop` does not exist on origin and the GitHub MCP was not connected (recorded in `artifacts/F-1/track-handoffs.md`, "Orchestrator — Ship Notes").
