---
description: Stage 17 of 28 — implement frontend services test-first, without UI. Invoked by the frontend track agent.
user-invocable: false
---
# /project:create-frontend-service

## Stage
17 of 28 — Create Frontend Service (Dataflow First)

## Setup
**Role**: `roles/frontend-dev.md`
**Guidelines**:
- `guidelines/test-first.md`
- `guidelines/3a-pattern.md`
- `guidelines/mockist-testing.md`
- `guidelines/dependency-injection.md`
- `guidelines/simple-design.md`
- `guidelines/test-boundary-only.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:test-first` — when writing tests before implementation
- `/project:3a-pattern` — when structuring tests (Arrange/Act/Assert)
- `/project:mockist-testing` — when deciding what to mock vs keep real
- `/project:dependency-injection` — when wiring dependencies between components
- `/project:simple-design` — when tempted to add speculative functionality
- `/project:test-boundary-only` — when deciding what to test in a class/function

## Input
Read:
- `artifacts/{feature}/07-development-plan.md` — current task
- `artifacts/{feature}/03-scenarios.md` — behavior to implement (includes Test Data section)
- Frontend interface definitions from Stage 16

## Task
Create frontend services with dataflow-first approach. Test WITHOUT UI — services are tested independently.

### Implementation Order (per service)

#### 1. API Client / Data Access Service (test → code)
```
TEST FIRST:
  Arrange: Mock HTTP client or fetch
  Act:     Call service.login(email, password)
  Assert:  Verify correct API endpoint called, request body sent, response parsed

THEN CODE:
  Implement the API client that calls backend endpoints
  - Uses the API contract types from Stage 16
  - Handles HTTP errors, transforms responses
```

#### 2. State Management Service (test → code)
```
TEST FIRST:
  Arrange: Create state service with mock API client
  Act:     Call state action (e.g., login, fetchUser)
  Assert:  Verify state transitions correctly, API client called with right params

THEN CODE:
  Implement state management
  - State transitions follow the state model from Stage 16
  - Actions coordinate API calls and state updates
  - Error states handled
```

#### 3. Business Logic / Presenter (test → code)
```
TEST FIRST:
  Arrange: Set up presenter with mock state service
  Act:     Call presenter method (e.g., handleLoginSubmit)
  Assert:  Verify validation, state updates, navigation

THEN CODE:
  Implement presenter/business logic
  - Validation logic
  - Data transformation
  - Coordination between state and UI
```

### Dataflow Pattern
```
UI Component (humble)
    ↓ user action
Presenter / Controller (testable logic)
    ↓ validated action
State Management (testable state transitions)
    ↓ API call
API Client (testable HTTP layer)
    ↓ HTTP request
Backend API
```

### Mocking Strategy
| Layer Under Test | What to Mock |
|-----------------|-------------|
| API Client | HTTP/fetch |
| State Management | API Client |
| Presenter | State Management |
| Component | Presenter (humble object — minimal logic in component) |

### Constraints
- Test WITHOUT UI — services run headless
- Walking skeleton service flow FIRST
- Every service method has a test BEFORE implementation
- Follow 3A pattern in all tests
- Use dependency injection — no hardcoded dependencies
- Humble Object: keep UI components thin, logic in services/presenters

## Output
- Service implementation files with corresponding test files
- Update `artifacts/{feature}/07-development-plan.md` — mark this task done

## Done
Summarize:
- Services implemented and tested
- Dataflow verified without UI
- All tests passing

After summary, **reviewer reviews**. Ask developer to double-check and open PR if approved.
