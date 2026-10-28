---
description: Stage 4 of 28 — prepare canonical test data for the scenarios. Invoked by the pre-dev track agent.
user-invocable: false
---
# /project:prepare-test-data

## Stage
4 of 28 — Prepare Test Data

## Setup
**Role**: `roles/qa.md`
**Guidelines**:
- `guidelines/bdd-scenarios.md`
- `guidelines/test-boundary-only.md`
- `guidelines/sequential-test-data.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:bdd-scenarios` — when writing Given/When/Then scenarios
- `/project:test-boundary-only` — when deciding what to test in a class/function
- `/project:validate-test-sequencing` — when test data involves sequential shared-state tests

## Input
Read:
- `artifacts/{feature}/03-scenarios.md`

## Task
Define test data needed to execute all scenarios.

1. **Read** all scenarios.
2. **For each scenario**, define:
   - Precondition data (Given state)
   - Input data (When action)
   - Expected output data (Then assertion)
3. **Include** boundary values and edge cases.
4. **Define** data in a format usable by both API tests and E2E tests.
5. **Consider** Object Mother pattern for reusable test fixtures.
6. **Sequential Execution Analysis** (for integration/E2E tests sharing a database):
   - List all tests in execution order (folder alphabetical → file alphabetical)
   - For each state-mutating test (POST/PUT/PATCH/DELETE), document the target resource, required pre-state, and post-state
   - Identify CASCADE DELETE paths and what records they destroy
   - Flag any test whose required pre-state is broken by an earlier test's mutation
7. **Dedicated Resource Assignment**:
   - Assign specific database records to specific test groups — no two groups share a mutable record
   - Create disposable resources for destructive tests (DELETE) — records that exist solely to be destroyed
   - Place all test-critical records under safe parents (parents no test deletes)
   - Document the resource map: which test group owns which records

Use the template at `templates/test-data.md`.

## Output
Append/Update the Test Data section in `artifacts/{feature}/03-scenarios.md`

## Done
Summarize:
- Number of data sets defined
- Scenarios covered

Ask: "Review the Test Data section in `artifacts/{feature}/03-scenarios.md` — edit if needed, then type **continue** to proceed to Stage 5: Plan UI Tests."
