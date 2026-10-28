---
description: Stage 18 of 28 — build components with component tests. Invoked by the frontend track agent.
user-invocable: false
---
# /project:create-components

## Stage
18 of 28 — Create Components (Component Test → Code)

## Setup
**Role**: `roles/frontend-dev.md`
**Guidelines**:
- `guidelines/test-first.md`
- `guidelines/3a-pattern.md`
- `guidelines/dependency-injection.md`
- `guidelines/simple-design.md`
- `guidelines/test-boundary-only.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:test-first` — when writing tests before implementation
- `/project:3a-pattern` — when structuring tests (Arrange/Act/Assert)
- `/project:dependency-injection` — when wiring dependencies between components
- `/project:simple-design` — when tempted to add speculative functionality
- `/project:test-boundary-only` — when deciding what to test in a class/function

## Input
Read:
- `artifacts/{feature}/07-development-plan.md` — current task
- `artifacts/{feature}/02-flow.md` — component structure and IDs
- `artifacts/{feature}/03-scenarios.md` — component behavior
- Frontend interface definitions (component props from Stage 16)
- Plain UI pages from Stage 15

## Task
Create plain components with state management. Write component tests FIRST, then implement.

### Implementation (per component)

#### Component Test First
```
TEST:
  Arrange: Render component with props (mock presenter/service)
  Act:     Simulate user interaction (click, type, submit)
  Assert:  Verify:
    - Correct elements rendered with correct content
    - Events fired to presenter/service on interaction
    - Conditional rendering based on state (loading, error, success)
    - Accessibility: correct roles, labels, aria attributes

THEN CODE:
  Build the component to pass all tests
  - Use component IDs from the flow (for Playwright targeting)
  - Connect to presenter/service via props or DI
  - Handle loading, error, and success states
  - No styling yet — structure and behavior only
```

#### Example Component Test
```
test suite "LoginForm":

  test "should call onSubmit with email and password when form is submitted":
    // Arrange
    onSubmit = create mock function
    render LoginForm with props (onSubmit=onSubmit, isLoading=false, error=null)

    // Act
    type "user@test.com" into element with id "email"
    type "pass123" into element with id "password"
    click element with id "login-submit"

    // Assert
    verify onSubmit was called with ("user@test.com", "pass123")

  test "should display error message when error prop is set":
    // Arrange & Act
    render LoginForm with props (onSubmit=mock function, isLoading=false, error="Invalid credentials")

    // Assert
    verify element with id "login-error" has text content "Invalid credentials"

  test "should disable submit button when isLoading is true":
    // Arrange & Act
    render LoginForm with props (onSubmit=mock function, isLoading=true, error=null)

    // Assert
    verify element with id "login-submit" is disabled
```

### Humble Component Pattern
```
Component (humble — renders UI, delegates all logic)
  └── receives props defined in Stage 16
  └── calls presenter/service methods on user interaction
  └── renders based on state passed via props
  └── NO business logic, NO direct API calls, NO complex state management
```

### Constraints
- Component test BEFORE component code
- Walking skeleton components FIRST
- Components are humble — all logic lives in services/presenters
- Use component IDs from the flow document
- No styling — plain structure with behavior
- Test user interactions, conditional rendering, and accessibility

## Output
- Component files with corresponding test files
- Update `artifacts/{feature}/07-development-plan.md` — mark this task done

## Done
Summarize:
- Components implemented and tested
- Component test results
- Humble object pattern applied

After summary, **reviewer reviews**. Ask developer to double-check and open PR if approved.
