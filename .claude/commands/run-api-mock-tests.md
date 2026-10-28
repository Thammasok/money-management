---
description: Stage 7 of 28 — run Bruno API tests against Mountebank mock impostors. Invoked by the pre-dev track agent.
user-invocable: false
---
# /project:run-api-mock-tests

## Stage
7 of 28 — Run API Mock Tests

## Setup
**Role**: `roles/qa.md`
**Guidelines**:
- `guidelines/test-pyramid.md`
- `guidelines/mockist-testing.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:test-pyramid` — when deciding what type of test to write
- `/project:mockist-testing` — when deciding what to mock vs keep real

## Input
Read:
- `artifacts/{feature}/06-api-test-plan.md`
- Bruno test collection files
- Mountebank impostor configuration files

## Task
Execute the planned API tests against the mock server to validate test specifications before any implementation begins.

1. **Start Mountebank** mock server with the impostor configuration:
   ```bash
   mb start --configfile imposters.json --allowInjection
   ```
2. **Verify impostors** are loaded correctly:
   ```bash
   curl http://localhost:2525/imposters
   ```
3. **Run Bruno tests** against the mock environment:
   ```bash
   bruno run collection/{feature} --env mock --format junit
   ```
4. **Analyze results**:
   - All tests should PASS against the mock server (this validates the test specs themselves)
   - If tests fail, the test spec or mock config is wrong — fix before proceeding
   - Verify response shapes match expected contracts
5. **Stop Mountebank**:
   ```bash
   mb stop
   ```

### Expected Outcome
- All API tests pass against the mock server
- This confirms that test specifications are correct and complete
- The mock server configuration accurately represents external dependencies
- When real implementation is done later, these same tests will run against real services

### Troubleshooting
- If a test fails against mock: fix the mock impostor or test spec, not the (nonexistent) implementation
- If Mountebank can't start: check port conflicts, verify impostor JSON syntax
- If Bruno can't connect: verify environment configuration points to correct mock server URL

## Output
Test execution results logged. Update `artifacts/{feature}/06-api-test-plan.md` with any corrections made.

## Done
Summarize:
- Tests passed / failed / total
- Any corrections made to test specs or mock config
- Confirmation that API contract is validated

Ask: "All API mock tests passed. Type **continue** to proceed to Stage 8: Plan Development."
