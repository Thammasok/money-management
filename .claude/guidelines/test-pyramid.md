# Test Pyramid

## Purpose
Maintain the right proportion of test types to maximize confidence while minimizing cost and execution time.

## Principles
- Many fast unit tests at the base, fewer integration tests in the middle, minimal E2E tests at the top.
- Avoid the ice-cream cone anti-pattern (mostly E2E tests).
- Each layer catches different types of bugs — all layers are needed.
- Tests must earn their keep — expensive tests need to justify their cost.

## Rules
- **DO**: Write many unit tests (fast, isolated, focused on boundaries).
- **DO**: Write component tests for service-level integration.
- **DO**: Write a small number of E2E tests for critical user flows.
- **DO**: Use subcutaneous tests (just under the UI) when UI testing is too brittle.
- **DON'T**: Rely primarily on E2E tests — they are slow and brittle.
- **DON'T**: Skip unit tests because "E2E covers it."
- **DON'T**: Write integration tests for logic that unit tests already cover.

## Patterns
### Pyramid Proportions
```
        /  E2E  \          Few — critical paths only (Playwright)
       / Component \       Some — service-level integration
      /    Unit     \      Many — boundary testing, fast, isolated
```

### Test Types in This Framework
| Level | Tool | Scope | Mocking Strategy |
|-------|------|-------|------------------|
| Unit | Test framework | Single function/class | Mock all dependencies |
| Component | Test framework | Service boundary | Mock external services |
| API Integration | Bruno | API endpoint | Real service + mock 3rd party + real DB |
| E2E | Playwright | Full user flow | Real API + mock 3rd party + real DB |

### Approximate Proportions
| Level | Ratio | Speed | Reliability |
|-------|-------|-------|-------------|
| Unit | ~70% of tests | Milliseconds | Very high |
| Component | ~20% of tests | Seconds | High |
| API Integration | ~7% of tests | Seconds–minutes | Medium-high |
| E2E (Playwright) | ~3% of tests | Minutes | Medium (can be flaky) |

### What Each Level Catches
- **Unit**: Logic bugs, boundary errors, calculation mistakes.
- **Component**: Wiring bugs, service integration issues, state management errors.
- **API Integration**: Contract mismatches, database query bugs, auth/authz issues.
- **E2E**: Full flow breaks, UI rendering issues, cross-service integration failures.

### Decision: What Test Type Should I Write?
```
Is this testing pure business logic?
  → Unit test (mock dependencies)

Is this testing how two components work together?
  → Component/service test (mock external boundaries)

Is this testing the API contract?
  → API integration test (Bruno, real DB, mock 3rd party)

Is this testing a complete user journey?
  → E2E test (Playwright, real everything except 3rd party)
```

## Anti-Pattern: Ice Cream Cone
```
DON'T:
  /    Lots of E2E tests    \     Slow, brittle, expensive
 /   Some integration tests  \
/     Few unit tests           \   Fast tests missing!
```
If you have more E2E tests than unit tests, the pyramid is inverted. Fix by:
1. Identify logic tested only by E2E → extract and unit test it.
2. Identify integration tested only by E2E → add component tests.
3. Remove E2E tests that duplicate lower-level coverage.
