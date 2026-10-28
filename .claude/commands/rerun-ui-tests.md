---
description: Stage 23 of 28 — re-run all UI tests after beautification. Invoked by the frontend track agent.
user-invocable: false
---
# /project:rerun-ui-tests

## Stage
23 of 28 — Re-run UI Tests (Post-Beautification)

## Setup
**Role**: `roles/qa.md`
**Guidelines**:
- `guidelines/test-pyramid.md`
- `guidelines/e2e-test-isolation.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:test-pyramid` — when deciding what type of test to write

## Input
- Playwright test files
- Mountebank impostor configuration
- Beautified frontend application

## Task
Re-run ALL Playwright tests after UI beautification to ensure styling changes did not break functionality.

### Execution Steps

1. **Start Mountebank**:
   ```bash
   mb start --configfile imposters/api-imposters.json --allowInjection
   ```

2. **Start frontend** (pointing to mock API):
   ```bash
   # Project-specific: start frontend dev server with mock API URL
   API_URL=http://localhost:4545 <start-frontend-command>
   ```

3. **Run ALL component tests first** (fast feedback):
   ```bash
   # Project-specific: run component/unit tests
   <test-runner> --filter=components
   ```

4. **Run ALL Playwright tests**:
   ```bash
   bash .claude/scripts/run-e2e.sh {feature}
   ```

5. **Compare with pre-beautification results**:
   - Same number of tests should pass
   - No new failures
   - If a test broke: the beautification changed structure — fix the styling, NOT the test

6. **Cleanup**:
   ```bash
   mb stop
   ```

### If Tests Break
The beautification introduced a structural change. This is NOT a test bug:
1. Identify which styling change broke the test
2. Revert that specific styling change
3. Re-apply styling without changing structure or IDs
4. Re-run tests
5. DO NOT modify tests to accommodate styling — that defeats the purpose

### Success Criteria
- [ ] ALL component tests pass (same as before beautification)
- [ ] ALL Playwright tests pass (same as before beautification)
- [ ] No test modifications were needed
- [ ] UI looks correct visually

## Output
Test execution results. Update `artifacts/{feature}/07-development-plan.md`.

## Done
Summarize:
- Component tests: passed / failed
- Playwright tests: passed / failed
- Any styling rollbacks needed

Ask: "All UI tests still pass after beautification. Type **continue** to proceed to Stage 24: Validate Frontend."
