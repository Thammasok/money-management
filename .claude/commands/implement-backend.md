---
description: Stage 12 of 28 — implement backend layers test-first against the interfaces. Invoked by the backend track agent.
user-invocable: false
---
# /project:implement-backend

## Stage
12 of 28 — Implement Backend

## Setup
**Role**: `roles/backend-dev.md`
**Guidelines**:
- `guidelines/test-first.md`
- `guidelines/3a-pattern.md`
- `guidelines/mockist-testing.md`
- `guidelines/dependency-injection.md`
- `guidelines/feature-flag.md`
- `guidelines/simple-design.md`
- `guidelines/test-boundary-only.md`
- `guidelines/walking-skeleton.md`
- `guidelines/state-machine.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:test-first` — when writing tests before implementation
- `/project:3a-pattern` — when structuring tests (Arrange/Act/Assert)
- `/project:mockist-testing` — when deciding what to mock vs keep real
- `/project:dependency-injection` — when wiring dependencies between components
- `/project:feature-flag` — when implementing brownfield changes
- `/project:simple-design` — when tempted to add speculative functionality
- `/project:test-boundary-only` — when deciding what to test in a class/function
- `/project:walking-skeleton` — when identifying or implementing the skeleton scenario
- `/project:diagnose-integration-failures` — when integration tests fail and need systematic diagnosis
- `/project:adjacent-code-review` — when pre-existing code in the story scope has anti-patterns

## Input
Read:
- `artifacts/{feature}/07-development-plan.md` — task list and current task
- `artifacts/{feature}/03-scenarios.md` — scenarios to implement (includes Test Data section)
- `artifacts/{feature}/06-api-test-plan.md` — API contracts to satisfy
- Interface definition files created in Stage 11

## Task
Implement the backend following strict TDD: write test FIRST, then write the minimum code to pass it. Implement the walking skeleton scenario FIRST.

### Implementation Order (per scenario)
For each scenario, implement layer by layer. **Consult `.claude/tech-stack-profile.md` → Architecture Pattern** for the concrete layer names in this project. The roles below (Entry Point, Business Logic, etc.) map to project-specific layers defined there.

#### 1. Entry Point layer (test → code)
```
TEST FIRST:
  Arrange: Create mock business logic layer, create entry point with mock
  Act:     Call entry point method with request DTO
  Assert:  Verify response status, response DTO shape, business logic was called correctly

THEN CODE:
  Write minimum entry point code to pass the test
  - Parse request → DTO
  - Call business logic layer
  - Return response DTO with correct status
```

#### 2. Business Logic layer (test → code)
```
TEST FIRST:
  Arrange: Create mock data access, mock external integration, create business logic with mocks
  Act:     Call business logic method with input
  Assert:  Verify output, verify data access/external integration interactions

THEN CODE:
  Write minimum business logic code to pass the test
  - Domain rules and orchestration
  - Coordinate data access and external integration calls
  - Transform data between DTOs
```

#### 3. Data Access layer (test → code)
```
TEST FIRST (with real backing service via docker-compose):
  Arrange: Set up test state (seed data or direct insert)
  Act:     Call data access method
  Assert:  Verify data was correctly persisted/retrieved

THEN CODE:
  Write minimum data access code to pass the test
  - Queries / storage operations
  - Entity mapping
```

#### 4. External Integration layer (test → code, if needed)
```
TEST FIRST (with real mock external service — e.g. Mountebank):
  Arrange: Ensure mock external service is running
  Act:     Call external integration method
  Assert:  Verify correct external call was made, response parsed correctly

THEN CODE:
  Write minimum external integration code to pass the test
  - Client calls (HTTP, gRPC, WebSocket, etc.)
  - Response parsing
  - Error handling
```

#### 5. Real-Time layer (test → code, if the feature requires real-time communication)
```
TEST FIRST:
  Arrange: Create gateway instance, create mock WebSocket clients
  Act:     Call handleConnection with token, call broadcast with event/data
  Assert:  Verify: valid tokens accepted, invalid tokens rejected (close 4401),
           broadcast sends JSON {event, data} to all connected clients,
           disconnected clients are removed from broadcast list

THEN CODE:
  Write minimum gateway code to pass the test
  - @WebSocketGateway with path (e.g., /ws/floor)
  - JWT validation from query param (?token=...)
  - Client registry (Set of connected clients)
  - broadcast(event, data) method that sends to all OPEN clients
  - Register as @Global module so services can inject it

THEN WIRE:
  Inject the gateway into services that mutate state (e.g., TableService, AreaService)
  - After each successful mutation, call gateway.broadcast(eventName, payload)
  - Add mock gateway ({ broadcast: jest.fn() }) to existing service tests
```

#### 6. Validation layer (test → code, if needed)
```
TEST FIRST:
  Arrange: Create validator with test input
  Act:     Call validate method
  Assert:  Verify validation passes/fails as expected

THEN CODE:
  Write minimum validator code to pass the test
```

#### 7. Utility functions (test → code, if needed)
```
TEST FIRST:
  Arrange: Set up input data
  Act:     Call utility function
  Assert:  Verify output

THEN CODE:
  Write minimum utility code to pass the test
```

### Mocking Strategy (Strictly Enforced)
Consult `.claude/tech-stack-profile.md` → Architecture Pattern for concrete layer names.

| Layer Role Under Test | What to Mock | What is Real |
|----------------------|-------------|-------------|
| Entry Point | Business Logic | Transport framework |
| Business Logic | Data Access, External Integration, Real-Time, Validation | Domain logic |
| Data Access | Nothing | Real backing service (docker-compose) |
| External Integration | Nothing | Real mock external service (Mountebank) |
| Real-Time | Mock clients (connection objects) | Connection handling, broadcast logic |
| Validation | Nothing | Validation logic |

### Walking Skeleton Flow
```
1. Implement walking skeleton scenario FIRST (all layers, end-to-end)
2. Verify the skeleton works with integration test
3. THEN implement remaining scenarios one by one
4. Each scenario: test first → code → refactor → next layer
```

### Feature Flag (Brownfield)
If this is a brownfield change:
```
// Wrap entry point with FeatBit feature flag
IF featbit.isEnabled("feature-{name}") THEN
  // New behavior
ELSE
  // Existing behavior
END IF
```

### Contract Verification (after each endpoint)
After implementing each endpoint (all layers), verify against the API test plan:
1. **Read** `06-api-test-plan.md` for the endpoint's expected behavior
2. **Compare** implementation's HTTP status codes, error messages, and response shapes against the plan
3. **Check role-specific behavior**: If the endpoint behaves differently per role (e.g., Manager override vs Receptionist conflict vs Waiter forbidden), verify each role path matches the plan
4. **Flag mismatches** early — don't wait for integration tests to discover contract divergence
5. **Update** either the implementation or the test plan (decide which is the correct business rule)

### After Each Sub-Task
1. All tests pass (red → green → refactor complete)
2. Reviewer reviews the code against all guidelines
3. Developer double-checks
4. Developer opens PR

## Output
- Test files for every implementation file
- Implementation files for each layer defined in tech-stack-profile (entry point, business logic, data access, external integration, real-time, validation, utils)
- Feature flag configuration (if brownfield)
- Update `artifacts/{feature}/07-development-plan.md` — mark tasks done
- Write `artifacts/{feature}/08-implementation-notes.md` — decisions made, patterns used

## Done
Summarize per sub-task:
- Tests written and passing
- Code implemented
- Mocking strategy applied correctly
- Feature flag status

After each sub-task, **reviewer reviews**. Ask developer to double-check and open PR if approved.
