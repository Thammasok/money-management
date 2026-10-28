---
description: Validator — check tests follow 3A, boundary-only, independence, correct mocking, pyramid proportions.
user-invocable: false
---
# /project:validate-test-quality

## Type
Validator Skill — run after development to verify test practices.

## Purpose
Validate that all tests follow the framework's testing standards: 3A pattern, boundary testing, independence, correct mocking, test pyramid proportions, and no non-determinism.

## Instructions

Read ALL test files in the project. For each test file, check every item below.

### 1. 3A Pattern (Arrange / Act / Assert)
Scan every test function:
- [ ] Each test has a clear Arrange phase (setup)
- [ ] Each test has exactly ONE Act phase (single action)
- [ ] Each test has an Assert phase (verification)
- [ ] No multi-step act-assert-act-assert sequences
- [ ] Phases are visually separated (blank lines or comments)

**Report**: List any test that violates 3A. Show the file:line and what's wrong.

### 2. Boundary Testing
- [ ] Tests target public methods/interfaces only
- [ ] No tests calling private methods directly
- [ ] No test-only methods added to production code
- [ ] No assertions on internal state or implementation details
- [ ] Tests verify WHAT (behavior) not HOW (implementation)

**Report**: List any test that tests internals instead of boundaries.

### 3. Test Independence
- [ ] No test reads state set by another test
- [ ] No test requires specific execution order
- [ ] Each test creates its own test data in Arrange
- [ ] No shared mutable state between tests (shared `let` variables mutated across tests)
- [ ] Each test would pass if run alone

**Report**: List any test that depends on another test.

### 4. Mocking Correctness
Check the mocking strategy matches the framework rules. Consult `.claude/tech-stack-profile.md` → Architecture Pattern for concrete layer names:

| Layer Role Under Test | Should Mock | Should Be Real |
|----------------------|-------------|---------------|
| Entry Point | Business Logic | ✓ |
| Business Logic | Data Access, External Integration, Real-Time | ✓ |
| Data Access | NOTHING | Backing service (docker) |
| External Integration | NOTHING | Mock external service (Mountebank) |
| Component | Presenter/Service | ✓ |
| Frontend Service | HTTP client | ✓ |

- [ ] Entry Points mock Business Logic (not real implementations)
- [ ] Business Logic mocks Data Access and External Integration
- [ ] Data Access tests use real backing service (docker-compose integration test)
- [ ] External Integration tests use real mock server (Mountebank)
- [ ] No mock on the class under test itself

**Report**: List any test with incorrect mocking strategy.

### 5. Test Pyramid Proportions
Count tests by type:
- Unit tests: ___ (target: ~70%)
- Component/service tests: ___ (target: ~20%)
- API integration tests (Bruno): ___ (target: ~7%)
- E2E tests (Playwright): ___ (target: ~3%)

- [ ] More unit tests than integration tests
- [ ] More integration tests than E2E tests
- [ ] No ice-cream cone anti-pattern

**Report**: Show actual proportions and whether pyramid is healthy.

### 6. Non-Determinism Check
- [ ] No random number generation without seed/stub in tests
- [ ] No current-time calls without clock stub in tests
- [ ] No timer/delay-dependent assertions without proper waits
- [ ] No tests that depend on external network calls (all mocked or dockerized)
- [ ] No tests that depend on file system state not created in Arrange

**Report**: List any potentially flaky test.

### 7. Integration Test State Management
For integration tests (Bruno API tests, Playwright E2E) that share a database:

- [ ] Each test group has dedicated, non-overlapping database resources
- [ ] Destructive tests (DELETE) target disposable-only resources — records that no other test depends on
- [ ] CASCADE DELETE paths analyzed — no test-critical records live under deletable parents
- [ ] State mutation trace exists: every state-mutating test documents its target resource, required pre-state, and post-state
- [ ] No test assumes seed state that an earlier test has already mutated
- [ ] Test execution order is enforced via folder/file naming (not left to chance)
- [ ] Tests are repeatable: running the full suite twice (with DB reset between) produces identical results

**Report**: List any integration test with shared resource conflicts, missing state contracts, or cascade vulnerabilities.

## Output Format
```markdown
# Test Quality Validation Report

## Summary
| Category | Status | Issues |
|----------|--------|--------|
| 3A Pattern | PASS/FAIL | N issues |
| Boundary Testing | PASS/FAIL | N issues |
| Independence | PASS/FAIL | N issues |
| Mocking | PASS/FAIL | N issues |
| Pyramid | PASS/FAIL | ratio |
| Non-Determinism | PASS/FAIL | N issues |
| Integration State | PASS/FAIL | N issues |

## Overall: PASS / NEEDS_IMPROVEMENT / FAIL

## Issues (detailed)
### {category}
- {file}:{line} — {description of issue}
- {file}:{line} — {description of issue}

## Recommendations
- {specific refactoring suggestion}
```
