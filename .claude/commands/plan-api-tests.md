---
description: Stage 6 of 28 — plan Bruno API test coverage. Invoked by the pre-dev track agent.
user-invocable: false
---
# /project:plan-api-tests

## Stage
6 of 28 — Plan API Tests

## Setup
**Role**: `roles/qa.md`
**Guidelines**:
- `guidelines/bdd-scenarios.md`
- `guidelines/test-pyramid.md`
- `guidelines/mockist-testing.md`
- `guidelines/sequential-test-data.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:bdd-scenarios` — when writing Given/When/Then scenarios
- `/project:test-pyramid` — when deciding what type of test to write
- `/project:mockist-testing` — when deciding what to mock vs keep real
- `/project:validate-test-sequencing` — when planning test execution order for stateful tests

## Input
Read:
- `artifacts/{feature}/01-requirements.md`
- `artifacts/{feature}/02-flow.md`
- `artifacts/{feature}/03-scenarios.md` (includes Test Data section)

## Task
Create API test specifications using Bruno and mock API server configuration using Mountebank.

1. **Read** all previous artifacts.
2. **For each API endpoint** identified in the flow:
   - Define the Bruno test collection structure
   - Specify HTTP method, URL, headers, request body
   - Define expected response status, headers, body
   - Map to test data from the Test Data section in `03-scenarios.md`
3. **For each external dependency** (3rd party APIs):
   - Create Mountebank impostor configuration
   - Define stubs: predicates (matching rules) and responses (canned responses)
   - Cover success responses, error responses, and timeout scenarios
4. **Organize** tests by endpoint and scenario:
   - Happy path requests
   - Validation error requests (400)
   - Not found requests (404)
   - Server error simulation (500)
   - Authentication/authorization scenarios (401/403)
5. **Mark** walking skeleton API tests.
6. **Define** test execution order: mock server setup → test execution → teardown.
7. **State Contract per Test** — for each state-mutating test, document:
   ```
   AT-XX {test name}:
     PRE:  {resource}.{field} = {required value}
     DO:   {HTTP method} {path}
     POST: {resource}.{field} = {new value}
   ```
   This makes the dependency chain explicit. Later tests can verify their PRE-state is satisfied by seed data + all previous POST-states.
8. **Execution Order Validation**:
   - List ALL tests in the exact order Bruno will execute them (folder alphabetical → file alphabetical)
   - Verify no test's PRE-state is violated by an earlier test's POST-state
   - Verify no CASCADE DELETE destroys records needed by later tests
   - If conflicts found, retarget tests to dedicated resources or reorder folders/files

### Bruno Collection Structure
```
collection/
├── {feature}/
│   ├── environments/
│   │   ├── mock.bru          # Points to Mountebank mock server
│   │   └── integration.bru   # Points to real service
│   ├── {endpoint-name}/
│   │   ├── happy-path.bru
│   │   ├── validation-error.bru
│   │   ├── not-found.bru
│   │   └── error.bru
│   └── bruno.json
```

### Mountebank Impostor Structure
```json
{
  "port": 4545,
  "protocol": "http",
  "stubs": [
    {
      "predicates": [{ "equals": { "method": "GET", "path": "/api/external/resource" } }],
      "responses": [{ "is": { "statusCode": 200, "body": { "data": "mocked" } } }]
    },
    {
      "predicates": [{ "equals": { "method": "GET", "path": "/api/external/resource/999" } }],
      "responses": [{ "is": { "statusCode": 404, "body": { "error": "Not found" } } }]
    }
  ]
}
```

### Mountebank Body Predicate Pitfalls
When using `contains` predicates on request bodies, beware of JSON formatting:

- **JSON serialization produces compact JSON** — no spaces after colons or commas
- **Body predicates must match the actual wire format**, not pretty-printed JSON

```json
// BAD: has space after colon — won't match compact JSON serialization
{ "contains": { "body": "\"shape\": \"circle\"" } }

// GOOD: compact format matches serialized JSON
{ "contains": { "body": "\"shape\":\"circle\"" } }
```

For string value matching (names, IDs), simple substrings work fine:
```json
// OK: "John" will be found anywhere in the body string
{ "contains": { "body": "John" } }
```

### Static Mock Limitations
Mountebank stubs are stateless — GET endpoints always return the same response regardless of previous POST/PATCH/DELETE calls. When designing stubs:

- **Assign stable IDs** in GET responses (e.g., `table-001`, `area-001`) — these become the source of truth for all downstream test fixtures
- **Ensure mutation endpoint responses include enough data** for the frontend to update local state (e.g., a PATCH /arrive response should include `{ tableId, status }`)
- **Tag test scenarios that require server-side state persistence** — these can only be fully validated at Stage 25 (E2E integration with real backend)

Use the template at `templates/api-test-plan.md`.

## Output
Write: `artifacts/{feature}/06-api-test-plan.md`

## Done
Summarize:
- Number of API test cases per endpoint
- Mountebank impostors defined
- Walking skeleton API tests marked
- External dependencies mocked

Ask: "Review `artifacts/{feature}/06-api-test-plan.md` — edit if needed, then type **continue** to proceed to Stage 7: Run API Mock Tests."
