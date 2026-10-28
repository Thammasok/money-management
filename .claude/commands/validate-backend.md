---
description: Stage 14 of 28 — validate backend practices and write the backend report. Invoked by the backend track agent.
user-invocable: false
---
# /project:validate-backend

## Stage
14 of 28 — Validate Backend Practices

## Setup
**Role**: `roles/reviewer.md`
**Guidelines**: ALL guidelines loaded

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:validate-test-quality` — to verify test practices
- `/project:validate-code-quality` — to verify code quality
- `/project:validate-architecture` — to verify architectural constraints
- `/project:validate-refactoring` — to verify safe refactoring
- `/project:validate-xp-practices` — to verify XP practices were followed
- `/project:validate-security` — to verify security practices (injection, auth, XSS, CSRF, race conditions, etc.)
- `/project:adjacent-code-review` — to review and fix pre-existing code in the story scope

## Input
Read:
- All backend source code and test files
- `artifacts/{feature}/07-development-plan.md`
- `artifacts/{feature}/08-implementation-notes.md`
- Git diff of all changes

## Task
Run all practice validators against the backend code, then refactor if needed.

### Validation Steps

#### 1. Test Quality Validation
Check every test file:
- [ ] **3A Pattern**: Every test has clear Arrange / Act / Assert sections
- [ ] **Boundary Testing**: Tests target public interfaces, not private methods
- [ ] **Independence**: No test depends on another test's state or execution order
- [ ] **Mocking Correctness** (see tech-stack-profile → Architecture Pattern for layer names):
  - Entry Points mock Business Logic ✓
  - Business Logic mocks Data Access, External Integration, Real-Time ✓
  - Data Access uses real backing service (docker-compose) ✓
  - External Integration uses real mock service (Mountebank) ✓
- [ ] **No Non-Determinism**: No flaky tests, no time-dependent logic without clock stubs, no random data without seeds
- [ ] **Test Pyramid**: More unit tests than integration tests

#### 2. Code Quality Validation
Check every source file:
- [ ] **No Code Smells**: No data clumps, long methods, duplication, feature envy
- [ ] **Coupling**: Services depend on interfaces, not concrete implementations
- [ ] **Technical Debt**: No shortcuts taken that need cleanup
- [ ] **Naming**: Ubiquitous language used consistently in code

#### 3. Architecture Validation
Consult `.claude/tech-stack-profile.md` → Architecture Pattern for concrete layer names.
- [ ] **Layer Correctness**: Entry Point → Business Logic → Domain → Data Access → External Integration
- [ ] **No Layer Violations**: Entry Points don't call Data Access directly, Business Logic doesn't do transport
- [ ] **Dependency Injection**: All dependencies injected via constructor
- [ ] **Interfaces Defined**: Every boundary has an interface
- [ ] **Humble Objects**: Entry Points and infrastructure code are thin

#### 4. XP Practices Validation
- [ ] **Feature Flag**: Brownfield changes wrapped in FeatBit flag
- [ ] **Walking Skeleton**: First scenario implemented end-to-end before others
- [ ] **No Early Functionality**: No speculative code, no unused methods
- [ ] **Self-Testing Code**: Every implementation file has corresponding test file
- [ ] **Interface First**: Interfaces were defined before implementation

#### 5. Security Validation
Run `/project:validate-security` and check:
- [ ] **Injection**: No SQL/command/NoSQL injection vectors
- [ ] **Authentication**: Passwords hashed, sessions managed, brute force protected
- [ ] **Access Control**: Authorization on every endpoint, no IDOR, CORS restricted
- [ ] **XSS**: Output encoded, no innerHTML with user input, CSP configured
- [ ] **CSRF**: CSRF tokens or SameSite cookies on state-changing operations
- [ ] **Sensitive Data**: No secrets in code/logs, errors don't leak internals
- [ ] **Mass Assignment**: DTOs whitelist fields, no direct request-to-DB spread
- [ ] **Race Conditions**: Transactions, optimistic locking, idempotency on critical ops
- [ ] **Rate Limiting**: Public endpoints rate-limited, request size bounded, pagination enforced
- [ ] **Dependencies**: No known CVEs, lockfile present

#### 6. Adjacent Code Review
Run `/project:adjacent-code-review` against all pre-existing code the story touches:
- [ ] **List** all pre-existing files the story imports from or depends on
- [ ] **Architectural violations**: Old Business Logic bypassing Data Access layer, missing interfaces, Entry Points with business logic
- [ ] **Naming drift**: Old code using different terms for the same domain concept
- [ ] **Duplicated logic**: Old code duplicating what new code provides (or vice versa)
- [ ] **Inconsistent patterns**: Old code in same module using different DI, error handling, or validation patterns
- [ ] **Test quality debt**: Old tests that mock incorrectly or lack 3A structure
- [ ] **Security debt**: SQL injection vectors, missing auth guards, exposed secrets
- Fix all issues found — do not just report them

#### 7. Dead Code Check
- [ ] **No unused classes/modules**: Every file is imported somewhere
- [ ] **No unused services/methods**: Every exported function is called somewhere
- [ ] **No unused interfaces/types**: Every exported type is referenced somewhere
- [ ] **No unused test files**: Every test file tests code that exists
- If dead code is found, **delete it immediately** — do not leave it "for future use"

#### 8. Fix ALL Issues Found (from steps 1–7)
Validation is not just reporting — **fix every issue before proceeding**:
- NEEDS_IMPROVEMENT and FAIL items must be fixed, not just noted
- Dead code must be deleted (classes, tests, interfaces, DTOs)
- Refactor ONLY within the story scope
- Ensure tests exist BEFORE refactoring
- Make small, safe transformations (not restructuring)
- Run all tests after each fix
- Follow red-green-refactor: tests must stay green throughout
- Re-validate after fixes to confirm the issue is resolved

### Scoring
For each category, rate: PASS / NEEDS_IMPROVEMENT / FAIL
- PASS: All checks satisfied
- NEEDS_IMPROVEMENT: Minor issues — **fix now**, then re-score as PASS
- FAIL: Must fix before proceeding

## Output
Write: `artifacts/{feature}/09-backend-validation-report.md`
Include: what was found, what was fixed, and final score (all PASS after fixes).

## Done
Summarize:
- Score per category (after fixes)
- Issues found and how they were fixed
- Confirmation that all tests pass after fixes

Ask: "Review validation report. Type **continue** to proceed to frontend (or deployment if frontend not chosen)."
