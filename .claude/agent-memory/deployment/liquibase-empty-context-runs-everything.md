---
name: liquibase-empty-context-runs-everything
description: The harness deployment templates say "production runs Liquibase without --contexts"; in real Liquibase that runs EVERY changeset, seed data included. Use an explicit non-test context.
metadata:
  type: project
---

`plan-deployment`, `create-deployment-config` and `validate-deployment-practices` tell the deployment track that production runs Liquibase **without** `--contexts` so that `context: test` seed changesets are skipped. That is wrong: with no runtime context filter Liquibase runs all changesets, including `context: test` ones. In F-1 it would have inserted `seed.user@example.test` with the known password `Seed-Pass-1` into production.

**Why:** proven 2026-10-29 with Liquibase 4.31.1 — offline `update-sql` emitted the seed `INSERT` with no filter and only the three schema changesets with `--contexts=prod`. A second run on a real database prints "Filtered out: 1 / Context mismatch: 1".

**How to apply:**
- Production compose: `--contexts=${LIQUIBASE_CONTEXTS:-prod}`. Changesets without a `context` attribute run under any filter; seeds stay `context: test`. Dev/test keep `--contexts=test`.
- Check without a database: `docker run --rm -v <abs>/db/changelog:/liquibase/changelog:ro -e LIQUIBASE_ANALYTICS_ENABLED=false liquibase/liquibase:4.31 --url=offline:postgresql --changelog-file=changelog/db.changelog-master.yaml [--contexts=prod] update-sql`, then look for the seed `INSERT`.
- Make it executable: the F-1 `scripts/smoke-test.sh` check 11 signs in as the seed User and expects 401 (`SMOKE_SKIP_SEED_CHECK=1` for a dev environment that runs `test`). It was shown to fail on a stack migrated with `LIQUIBASE_CONTEXTS=test`.
- The harness text lives upstream in saas-factory (not editable here): flag it in the handoff each time until it is fixed.
- A one-shot compose service that exited is started again by every `docker compose up` (observed), so a deploy re-runs the migration from the mounted changelog; no image rebuild needed in compose. Kubernetes has no bind mount, so the changelog would have to be baked into an image there.
- Re-proved on F-2 (4.31.1): a feature's schema changesets carry NO `context` so `prod` runs them (F-2/001-002: `prod` emits five changesets and no `INSERT`; an empty filter adds F-1-004's seed `INSERT`); a real prod database reports "Run: 5, Filtered out: 1 (Context mismatch)"; the smoke test's check 11 has a negative control (a stack migrated with `LIQUIBASE_CONTEXTS=test` fails there; `SMOKE_SKIP_SEED_CHECK=1` for a dev environment). Offline command without a redirect: see agent-sandbox-validation-recipes ("Added in F-2").
