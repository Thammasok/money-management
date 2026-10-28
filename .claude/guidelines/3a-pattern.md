# 3A Pattern (Arrange, Act, Assert)

## Purpose
Structure every unit test into three clear phases for readability, consistency, and focused testing.

## Principles
- Every test should have exactly one reason to fail.
- The three phases should be visually distinct in the test code.
- Assert-first approach can help design tests from expected outcomes.

## Rules
- **DO**: Separate Arrange, Act, and Assert with blank lines or comments.
- **DO**: Keep each phase focused — one action, clear assertions.
- **DO**: Multiple related assertions are acceptable when testing object modifications.
- **DON'T**: Mix arrange and act phases.
- **DON'T**: Write multi-step act-assert-act-assert sequences (that's an integration scenario, not a unit test).
- **DON'T**: Assert on things unrelated to the behavior being tested.

## Patterns
### Structure
```
// Arrange — set up the test context
service = create UserService with mockRepository
userData = { name: "John", email: "john@example.com" }

// Act — execute the behavior under test
result = service.createUser(userData)

// Assert — verify the expected outcome
assert result.id is defined
assert result.name equals "John"
```

### Assert-First Approach
When stuck, work backwards:
1. Start by writing the assertion (what should be true after the action).
2. Then write the action that produces the result.
3. Then set up whatever context the action needs.

### Per-Phase Rules
**Arrange** — set up all preconditions and inputs:
- Create test doubles (mocks, stubs).
- Instantiate the unit under test with injected dependencies.
- Prepare input data and any expected state.

**Act** — execute exactly ONE action:
- Call the method being tested and store the result.
- Keep this section to 1-2 lines at most.

**Assert** — verify the outcome:
- Check return values and state changes.
- Check interactions with mocks (when doing behavior verification).
- Multiple related assertions are OK (one behavior verified from several angles).

## Anti-Patterns
### Multi-Act (testing multiple behaviors in one test)
```
// BAD — two actions, unclear what's being tested
user  = service.createUser(input)
found = service.getUserById(user.id)   // second act!
assert found.name equals "John"

// GOOD — separate tests, one act each
test "creates a user"        { /* one act: createUser */ }
test "finds a user by id"    { /* one act: getUserById */ }
```

### Arrange in Assert (setup mixed with verification)
```
// BAD — building expected data during the assert phase
assert result equals { id: generateId(), name: "John" }   // generateId() is arrangement

// GOOD — expected values defined in Arrange
expectedId = "1"
// ... act ...
assert result.id equals expectedId
```
