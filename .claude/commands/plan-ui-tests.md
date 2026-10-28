---
description: Stage 5 of 28 — plan Playwright UI test coverage. Invoked by the pre-dev track agent.
user-invocable: false
---
# /project:plan-ui-tests

## Stage
5 of 28 — Plan UI Tests

## Setup
**Role**: `roles/qa.md`
**Guidelines**:
- `guidelines/bdd-scenarios.md`
- `guidelines/test-pyramid.md`
- `guidelines/test-boundary-only.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:bdd-scenarios` — when writing Given/When/Then scenarios
- `/project:test-pyramid` — when deciding what type of test to write
- `/project:test-boundary-only` — when deciding what to test in a class/function

## Input
Read:
- `artifacts/{feature}/02-flow.md`
- `artifacts/{feature}/03-scenarios.md` (includes Test Data section)

## Task
Create a UI test plan based on customer actions from the flow and scenarios.

1. **Read** flow, scenarios, and test data.
2. **Map** every customer action from the flow to a UI test case.
3. **For each scenario**, define:
   - Page/component under test
   - User interactions (click, type, navigate)
   - Assertions (visible text, state changes, navigation)
   - Test data to use
4. **Organize** by page/component for later Playwright implementation.
5. **Mark** walking skeleton tests.

Use the template at `templates/ui-test-plan.md`.

## Output
Write: `artifacts/{feature}/05-ui-test-plan.md`

## Done
Summarize:
- Number of UI test cases
- Pages/components covered
- Walking skeleton tests marked

Ask: "Review `artifacts/{feature}/05-ui-test-plan.md` — edit if needed, then type **continue** to proceed to Stage 6: Plan API Tests."
