# Test Boundary Only

## Purpose
Focus tests on public interfaces and boundaries, not internal implementation details. This produces stable tests that survive refactoring.

## Principles
- Black-box testing: test what a component does, not how it does it.
- Tests should verify behavior through public APIs only.
- Tests that rely on implementation details break during refactoring.
- Every test must be independent — no shared state, no execution order dependency.

## Rules
- **DO**: Test through public methods and interfaces only.
- **DO**: Test boundary conditions (valid input, invalid input, edge cases).
- **DO**: Ensure every test can run independently in any order.
- **DO**: Test the contract (input → output), not the internal steps.
- **DON'T**: Test private methods directly.
- **DON'T**: Add test-only methods that expose internals.
- **DON'T**: Rely on unpromised behavior (e.g., specific iteration order).
- **DON'T**: Write tests that must run in a specific sequence.
- **DON'T**: Test every possible case — focus on boundaries and critical paths.

## Patterns
### What IS a Boundary?
A boundary is the public interface of a component — the contract it exposes to its consumers.

### What to Test at Each Boundary (see tech-stack-profile → Architecture Pattern for concrete layer names)
```
Entry Point boundary:             Request → Response (status, body)
Business Logic boundary:          Input DTO → Output DTO / side effects
Data Access boundary:             Query/command → data result (with real backing service)
External Integration boundary:    Request → external response (with mock 3rd party)
```
At each boundary, cover:
- **Valid input** → expected output
- **Invalid input** → appropriate error/rejection
- **Edge cases** → boundary values (0, null, empty, max)
- **State transitions** → for stateful components

### What NOT to Test
- Private methods (test them through the public interface).
- Internal data structures (they may change during refactoring).
- Implementation sequence (which internal methods are called in what order).
- Framework internals (trust the framework).

### Independence Checklist
- [ ] Test sets up its own data (Arrange)
- [ ] Test does not depend on another test's output
- [ ] Test cleans up after itself (or uses isolated context)
- [ ] Test passes when run alone
- [ ] Test passes when run in any order
- [ ] Test passes when run in parallel

### Example: Testing Through Boundaries
```
// BAD — testing internal implementation
test "calls hashPassword before saving" {
  spy = spyOn(service, "hashPassword")    // private method!
  service.createUser(input)
  assert spy was called                   // implementation detail!
}

// GOOD — testing the boundary behavior
test "creates user and does not store plain text password" {
  result = service.createUser({ email: "a@b.com", password: "plain" })
  saved  = repo.findById(result.id)
  assert saved.password not equals "plain"   // tests BEHAVIOR, not implementation
}
```
