---
description: Stage 6.5 of 28 — validate test data sequencing across the planned tests. Invoked by the pre-dev track agent.
user-invocable: false
---
# /project:validate-test-sequencing

## Stage
6.5 of 28 — Validate Test Data Sequencing

## Setup
**Role**: `roles/qa.md`
**Guidelines**:
- `guidelines/sequential-test-data.md`
- `guidelines/test-pyramid.md`
- `guidelines/bdd-scenarios.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:test-boundary-only` — when deciding scope of test data
- `/project:walking-skeleton` — when prioritizing which tests need dedicated resources

## Input
Read:
- `artifacts/{feature}/03-scenarios.md` (Test Data section) — test data definitions
- `artifacts/{feature}/06-api-test-plan.md` — API test execution order and expectations

## Task
Verify that test data and test execution order work together without state conflicts.

### Step 1: Determine Execution Order

List ALL integration tests in the exact order they will execute, accounting for:
- Folder alphabetical ordering (Bruno runs folders A-Z)
- File alphabetical ordering within folders
- Sequence numbers in .bru files (if runner respects them)

```
Execution Order:
1. 01-auth/AT-01-login.bru
2. 01-auth/AT-05-login-manager.bru
3. 02-floor/AT-02-get-floor.bru
...
```

### Step 2: Build State Mutation Trace

For every test that mutates database state (POST, PUT, PATCH, DELETE), document:

| # | Test | Target Resource | Required Pre-State | Operation | Post-State | Side Effects |
|---|------|----------------|-------------------|-----------|------------|--------------|
| 1 | AT-XX | resource-001 | initial | POST /action | mutated | Creates child record |
| 2 | AT-YY | parent-002 | exists | DELETE | deleted | CASCADE: child-010,011,012 deleted |
| 3 | AT-ZZ | resource-099 | exists | DELETE | deleted | CASCADE: dependents deleted |

Read-only tests (GET) can be noted but don't need mutation tracking.

### Step 3: CASCADE Impact Analysis

For every DELETE test:
1. Identify the target table
2. Trace all CASCADE DELETE foreign keys
3. List ALL records that will be destroyed
4. Check if any later test depends on those records

```
AT-YY: DELETE /parents/parent-002
  CASCADE path: parent → child → grandchild
  Records destroyed:
    - child-010, child-011, child-012 (child_entity)
    - Any grandchild records under those children
  Later tests affected:
    - AT-AA needs child-010 → CONFLICT!
    - AT-BB needs child-011 → CONFLICT!
```

### Step 4: Dedicated Resource Mapping

For each test group that needs specific resource states:

| Test Group | Needs | Dedicated Resource | Seed State |
|-----------|-------|-------------------|------------|
| Create (AT-XX) | resource in initial state | resource-001 | initial |
| List with data (AT-YY) | resource with N child records | resource-013 | initial + N seed children |
| Invalid transition (AT-ZZ) | resource in specific state | resource-014 | specific state |
| Role-restricted (AT-AA) | resource in guarded state | resource-007 | guarded state + dependency |
| Delete (AT-BB) | disposable resource | resource-099 | exists (disposable) |

**Rules**:
- No two test groups share a mutable resource
- Disposable resources are only referenced by their destructive test
- All dedicated resources are in safe parents (not cascade-deletable)

### Step 5: Conflict Detection

Flag any case where:
- [ ] Test A mutates state that Test B (running later) depends on in its original form
- [ ] A CASCADE delete removes records needed by later tests
- [ ] Two tests target the same record for conflicting operations
- [ ] A test assumes seed state but earlier tests have changed it
- [ ] A read test depends on exact counts that earlier mutations change

### Step 6: Update Artifacts

If conflicts found:
1. **Update the Test Data section in `03-scenarios.md`**: Add dedicated resources, disposable resources, state mutation trace
2. **Update `06-api-test-plan.md`**: Retarget tests to use dedicated resources, fix execution order
3. **Add to test data**: State Mutation Trace table, Dedicated Resource Map, Disposable Resource List

## Output
Update:
- `artifacts/{feature}/03-scenarios.md` (Test Data section) — add state mutation trace, dedicated resource map
- `artifacts/{feature}/06-api-test-plan.md` — retarget any conflicting tests

## Done
Summarize:
- Conflicts found and resolved
- Dedicated resources assigned
- CASCADE impacts identified
- Tests retargeted

Ask: "Review updated test data and API test plan. Type **continue** to proceed to Stage 7: Run API Mock Tests."
