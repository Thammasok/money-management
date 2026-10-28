---
name: bruno-mountebank-quirks
description: Bruno CLI 4.x and Mountebank 2.9 pitfalls hit at Stage 7 in this repo (cwd, cookies, sendRequest in safe sandbox, stateful injection)
metadata:
  type: project
---

Stage 7 tooling facts learned on F-1 (2026-10-28); tools are repo-root devDependencies (`node_modules/.bin/bru`, `mb`), not global.

- `bru run <abs path>` fails with "You can run only at the root of a collection". Run via root npm scripts that `cd collection/{F-n}` themselves (`npm --prefix <root> run api:test:mock`) — bash discipline forbids `cd &&` in my own calls.
- Bruno 4 persists cookies by default → pass `--disable-cookies` and send `Cookie: sid={{var}}` explicitly, else "no session" tests are order-sensitive.
- Default `--sandbox safe` (QuickJS): `await bru.sendRequest(opts)` rejects non-2xx with an object lacking `response.status`; use the callback form `bru.sendRequest(opts, (err, res) => …)`, where `err.status` is set.
- `--reporter-junit ../../test-results/x.xml` exits non-zero if the dir is missing — omit or create it.
- "ERROR: failed to copy trust settings of system certificate" lines are macOS sandbox noise.
- Mountebank stateful double: one stub with `inject` using `config.state`, started with `--allowInjection`; keep the JS readable in `mocks/*.inject.js` and generate `mocks/imposters.json` via `mocks/build-imposters.mjs`. Start with `run_in_background`, stop with TaskStop, delete mb.pid/mb.log after.
- npm install in the sandbox cannot write `*.pem` (mountebank HTTPS certs) — fine for HTTP impostors.

- (F-2, 2026-10-29) One imposter can hold several injection stubs (`predicates: [{ matches: { path: '^/api/v1/(…)' } }]` first, Identity catch-all last); `config.state` is SHARED across them, so a per-module `mocks/*.inject.js` can read Identity's `state.sessions`. Mirror Nest's order: 415 → malformed JSON 400 → unknown route 404 → 401 → DTO 400 → 404.
- (F-2) ~100 `.bru` files: write a one-off Node generator in the scratchpad (not committed) and run it once — bash discipline forbids loops/heredocs, and hand-writing each file is too slow. Wait for mb readiness with Monitor on `curl :2525/imposters/4545`.

**Why:** each of these cost a run; the Fix Budget is 5 runs per stage.
**How to apply:** at Stage 7 of every later feature, add the new endpoints to the same 4545 impostor (see [[e2e-mode-via-proxy]]).
