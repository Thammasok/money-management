---
description: Stage 13 of 28 — run backend integration tests (Bruno + real backing services). Invoked by the backend track agent.
user-invocable: false
---
# /project:run-backend-integration

## Stage
13 of 28 — Run Backend Integration Tests

## Setup
**Role**: `roles/qa.md`
**Guidelines**:
- `guidelines/test-pyramid.md`
- `guidelines/mockist-testing.md`
- `guidelines/walking-skeleton.md`
- `guidelines/sequential-test-data.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:test-pyramid` — when deciding what type of test to write
- `/project:mockist-testing` — when deciding what to mock vs keep real
- `/project:walking-skeleton` — when identifying or implementing the skeleton scenario
- `/project:diagnose-integration-failures` — when integration tests fail and need systematic diagnosis
- `/project:validate-test-sequencing` — when failures suggest state mutation conflicts between tests

## Input
Read:
- `artifacts/{feature}/06-api-test-plan.md` — API tests to run
- `artifacts/{feature}/07-development-plan.md` — verify all backend tasks done
- Bruno test collection files
- Mountebank impostor configuration

## Task
Run ALL API tests against the real backend service with mock 3rd party and real database.

### Environment Setup
```
Real backend service
  + Real database (docker-compose)
  + Real cache (docker-compose)
  + Mock 3rd party (Mountebank)
```

### Execution Steps

1. **Start backing services** (DB + Liquibase migrations + Mountebank):
   ```bash
   docker compose -f docker-compose.backing-service.yml up -d
   ```
   The `migrations` service runs Liquibase with `--contexts=test` automatically (schema + seed data), then exits. No manual Liquibase CLI needed.

2. **Wait for services to be ready**:
   ```bash
   docker compose -f docker-compose.backing-service.yml ps
   # db and mountebank should show "healthy"
   # migrations should show "exited (0)"
   ```

3. **Start the backend service** (in test mode). Pass env via the allow-listed wrapper — **never an inline `FOO=1 cmd` prefix** (the bash-lint hook blocks it, and it would force an approval prompt) — and background it with the Bash tool's `run_in_background: true`, **never `&` / `$!`**:
   ```bash
   bash .claude/scripts/run-with-env.sh DATABASE_URL=... JWT_SECRET=... -- <project start command>
   ```
   Then wait for it to be ready with the Monitor tool / a health-check poll, not a foreground `sleep`. See `.claude/rules/bash-discipline.md`.

5. **Run Bruno API tests** against the real service:
   ```bash
   bruno run collection/{feature} --env integration --format junit
   ```

6. **Verify repeatability** — reset DB and run again:
   ```bash
   # Reset DB to clean seed state
   docker exec -i <db-container> psql -U <user> -d <db> < db/seed-reset.sql
   # Run Bruno tests a second time
   bruno run collection/{feature} --env integration --format junit
   ```
   Both runs must produce identical results. If the second run fails, you have state leakage — a test depends on seed state that an earlier test mutated. Use `/project:diagnose-integration-failures` to trace the issue.

7. **Run unit tests** to confirm nothing is broken:
   ```bash
   # Project-specific test runner
   ```

8. **Analyze results**:
   - ALL API tests must pass on BOTH runs
   - ALL unit tests must pass
   - If any test fails: investigate, fix, and re-run
   - Do NOT skip failing tests

9. **Teardown**:
   ```bash
   docker-compose -f docker-compose.backing-service.yml down -v
   ```

### Failure Protocol
If tests fail, invoke `/project:diagnose-integration-failures` and follow its methodology:

1. **Categorize each failure** by type: State Mutation, Cascade Side Effect, Contract Mismatch, Implementation Bug, Test Data Gap, or Ordering Issue
2. **For State Mutation / Cascade failures**: Build a state mutation trace — walk through ALL tests in execution order, tracking how each test changes DB state, to find which earlier test broke the failing test's precondition
3. **For Contract Mismatch failures**: Compare the test plan's expected behavior against the implementation's actual behavior. Determine which is the correct business rule and update the incorrect artifact.
4. **Apply the fix** per category:
   - State Mutation → retarget test to a dedicated resource
   - Cascade Side Effect → move resource to a safe parent
   - Contract Mismatch → align test or implementation
   - Implementation Bug → fix code + unit tests
   - Test Data Gap → add seed data
   - Ordering Issue → rename folders/files for correct alphabetical order
5. **Reset database** (TRUNCATE all tables, re-seed from scratch)
6. **Re-run ALL tests** — not just the fixed one
7. Repeat until all tests pass

### Success Criteria
- [ ] All Bruno API tests pass against real service
- [ ] All Bruno API tests pass on SECOND run (after DB reset + re-seed) — proves repeatability
- [ ] All unit tests pass
- [ ] Walking skeleton scenario works end-to-end
- [ ] All remaining scenarios work
- [ ] No test is skipped or ignored

## Output
Test execution results. Update `artifacts/{feature}/07-development-plan.md`.

## Done
Summarize:
- Total tests: passed / failed / skipped
- Walking skeleton status
- Any issues found and fixed

Ask: "All backend integration tests passed. Type **continue** to proceed to Stage 14: Validate Backend."
