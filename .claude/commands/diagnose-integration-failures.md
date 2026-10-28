---
description: Consideration skill — systematic diagnosis when integration tests fail (Stages 13/21/25).
user-invocable: false
---
# /project:diagnose-integration-failures

## Type
Consideration Skill — invoke when integration tests fail and need systematic diagnosis.

## When to Use
- During Stage 13 when Bruno API tests fail against real backend
- During Stage 25 when Playwright E2E tests fail against real backend
- Any time an integration test suite has multiple failures with unclear root causes

## Setup
**Role**: `roles/qa.md`
**Guidelines**:
- `guidelines/sequential-test-data.md`
- `guidelines/test-pyramid.md`
- `guidelines/mockist-testing.md`

## Methodology

### Step 1: Categorize Each Failure

For each failing test, determine the failure type:

| Type | Symptom | Example | Fix Target |
|------|---------|---------|-----------|
| **State Mutation** | Got unexpected status (409/404), resource in wrong state | Test expects table=free but earlier test reserved it | Seed data or test target resource |
| **Cascade Side Effect** | Got 404, resource doesn't exist | Parent deleted with CASCADE, child records gone | Move resource to safe parent |
| **Contract Mismatch** | Got different HTTP status than expected | Expected 409 Conflict, got 403 Forbidden | Reconcile test plan vs implementation |
| **Implementation Bug** | Wrong business logic, wrong response shape | Validation missing, wrong field in response | Service/repository code |
| **Test Data Gap** | No seed data for the scenario | Test needs 3 reservations, seed has 0 | Add to seed data |
| **Ordering Issue** | Test runs before its dependency | Auth test runs after protected endpoint test | Fix folder/file naming for correct order |

### Step 2: State Mutation Trace (for State Mutation / Cascade failures)

Build a trace of all tests up to the failing test:

```
Seed State:
  resource-001: {initial state}
  resource-002: {initial state}
  parent-002: exists (with child-010, child-011)

Test Execution:
  AT-03: POST /resources/resource-001/action → resource-001 state changes
  AT-18: DELETE /parents/parent-002 → CASCADE deletes child-010, child-011
  ...
  AT-35: GET /children/child-010/details → 404 (child-010 was cascade-deleted!)
         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
         ROOT CAUSE: AT-18 cascade-deleted parent-002 which contained child-010
```

**Technique**: Start from the failing test, identify what state it needs, then trace backward through all preceding tests to find which one broke that state.

### Step 3: Contract Reconciliation (for Contract Mismatch failures)

When the test expects one behavior but the implementation does another:

1. **Read the API test plan** for the expected behavior (status code, error message)
2. **Read the implementation** for the actual behavior
3. **Determine which is the correct business rule**:
   - Is the test plan's expectation the intended design?
   - Did the implementation make a valid but different design choice?
4. **Update the incorrect artifact**:
   - If test plan is wrong → update the .bru file and 06-api-test-plan.md
   - If implementation is wrong → fix the service code and update unit tests
5. **Document the decision** in 08-implementation-notes.md

### Step 4: Apply the Fix

Based on category:

| Category | Fix Approach |
|----------|-------------|
| State Mutation | Retarget test to a dedicated resource that won't be mutated |
| Cascade Side Effect | Move resource to a safe parent that no test deletes |
| Contract Mismatch | Align test expectation OR implementation (decide which is correct) |
| Implementation Bug | Fix the code, update unit tests |
| Test Data Gap | Add seed data for the missing scenario |
| Ordering Issue | Rename folders/files to enforce correct alphabetical order |

### Step 5: Verify the Fix

After fixing:
1. **Reset the database** — TRUNCATE all tables, re-seed from scratch
2. **Re-run ALL tests** — not just the fixed one (other tests may be affected)
3. **Run twice** — reset and run again to verify repeatability
4. **Re-run unit tests** — ensure fixes didn't break existing unit tests

## Common Patterns

### Pattern: Dedicated Resource per Test Group
When multiple test groups need different states of the same entity type:
```
Create tests       → resource-001 (initial state, mutated by creation test)
Status transitions → resource-007 (pre-set state, never touched by create tests)
Delete tests       → resource-099 (disposable, only exists to be deleted)
```

### Pattern: Safe vs Disposable Parents
```
parent-001 (safe): Contains all child records needed by tests after the CRUD tests
parent-002 (disposable): Contains only child records that can be lost when parent is deleted
```

### Pattern: Role-Specific Error Codes
When the same action returns different errors for different roles:
```
Conflict + Admin     → 200 (override allowed)
Conflict + Editor    → 409 Conflict (must resolve first)
Conflict + Viewer    → 403 Forbidden (escalate to admin)
```
Ensure the test plan documents role-specific behavior distinctly.

## Output
After diagnosis and fixes:
- Update seed data files if resources were added/moved
- Update .bru test files if targets or expectations changed
- Update unit tests if service logic changed
- Update `08-implementation-notes.md` with decisions made
- Re-run full suite to verify all fixes
