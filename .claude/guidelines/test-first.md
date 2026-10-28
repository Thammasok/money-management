# Test First (TDD)

## Purpose
Write tests BEFORE implementation code to clarify requirements, drive design, and ensure every piece of code has a corresponding test from the start.

## Principles
- Red → Green → Refactor cycle.
- Tests define the expected behavior before code exists.
- Writing tests first produces better design through testability pressure.
- No code is written without a failing test that demands it.

## Rules
- **DO**: Write a failing test first that describes the expected behavior.
- **DO**: Write the minimum code to make the test pass (green).
- **DO**: Refactor only after the test is green.
- **DO**: Keep the red-green-refactor cycle small (minutes, not hours).
- **DON'T**: Write implementation code before a test exists.
- **DON'T**: Write more test than needed — test boundaries only, not all cases.
- **DON'T**: Skip the refactor step.
- **DON'T**: Write tests that depend on other tests.

## Patterns
### The TDD Cycle
```
1. RED:    Write a test that fails (describes desired behavior)
2. GREEN:  Write minimum code to pass the test
3. REFACTOR: Clean up code while keeping tests green
4. REPEAT
```

### Two Hats
- Hat 1: Adding behavior (write test + make it pass)
- Hat 2: Refactoring (improve structure, tests stay green)
- Never wear both hats at the same time.

### Running Tests During the Cycle
- During RED/GREEN, run ONLY the single test file you are working on — never the full suite.
  - RED: a new test should FAIL. If it PASSES, the test is wrong (it tests existing behavior, not new behavior) — rewrite it.
  - GREEN: the corresponding file should PASS. If it FAILS, the implementation is wrong — read the failure output and fix the implementation.
- Do NOT run full suites manually. The test gate runs every affected suite when the track agent finishes and blocks until all pass.
- During REFACTOR, tests must still pass — the gate verifies this automatically when you finish.

### Applying TDD Per Layer
(See tech-stack-profile → Architecture Pattern for concrete layer names.)

| Layer | Test | Then Code |
|-------|------|-----------|
| Entry Point (Controller) | Mock Business Logic, test request → response | Implement entry point |
| Business Logic (Service) | Mock Data Access/External Integration/Validator, test input → output + interactions | Implement business logic |
| Data Access (Repository) | Real DB (docker-compose), test query → data | Implement data access |
| External Integration (Gateway) | Real mock 3rd party (Mountebank), test call → response | Implement integration |
| Validator | Test input → validation result | Implement validator |
| Component | Mock presenter/service, test render + interactions | Implement component |
| Frontend Service | Mock HTTP client, test method → result | Implement service |

### Test Structure
Every test follows the 3A pattern (see `3a-pattern.md`):
```
// Arrange — set up context
// Act — execute the behavior
// Assert — verify the outcome
```

## Common Mistakes
- Writing implementation before the test (defeats the purpose).
- Writing too much code to pass the test (gold-plating).
- Refactoring while adding behavior (mixing hats).
- Testing implementation details instead of behavior.
- Skipping the RED step — the test must fail first to prove it tests something real.
