---
description: Stage 24 of 28 — validate frontend practices and write the validation report. Invoked by the frontend track agent.
user-invocable: false
---
# /project:validate-frontend

## Stage
24 of 28 — Validate Frontend Practices

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
- `/project:validate-security` — to verify security practices (XSS, CSRF, sensitive data, dependencies, etc.)
- `/project:adjacent-code-review` — to review and fix pre-existing code in the story scope

## Input
Read:
- All frontend source code and test files
- `artifacts/{feature}/07-development-plan.md`
- `artifacts/{feature}/08-implementation-notes.md`
- Git diff of all changes

## Task
Run all practice validators against the frontend code, then refactor if needed.

### Validation Steps

#### 1. Test Quality Validation
Check every test file:
- [ ] **3A Pattern**: Every test has clear Arrange / Act / Assert sections
- [ ] **Boundary Testing**: Tests target component props and service interfaces, not internals
- [ ] **Independence**: No test depends on another test's state or execution order
- [ ] **Mocking Correctness**:
  - Components mock services/presenters ✓
  - Services mock API clients ✓
  - API clients mock HTTP/fetch ✓
  - Playwright tests use mock API server (Mountebank) ✓
- [ ] **No Non-Determinism**: No flaky tests, no timing-dependent assertions without proper waits
- [ ] **Test Pyramid**: More component/unit tests than Playwright E2E tests
- [ ] **Page Object Model**: Playwright tests use page objects, not raw selectors

#### 2. Code Quality Validation
Check every source file:
- [ ] **No Code Smells**: No data clumps, long methods, duplication, god components
- [ ] **Coupling**: Components depend on props/interfaces, not concrete services
- [ ] **Humble Object**: UI components are thin — logic lives in services/presenters
- [ ] **Naming**: Ubiquitous language used consistently

#### 3. Architecture Validation
- [ ] **Dataflow Correct**: Component → Presenter → State → API Client → Backend
- [ ] **No Layer Violations**: Components don't call APIs directly, services don't do DOM manipulation
- [ ] **Dependency Injection**: All dependencies injected, not imported directly
- [ ] **Interfaces Defined**: API contracts, state models, component props, service interfaces all present
- [ ] **Component IDs**: All IDs from the flow document are present in the rendered output

#### 4. XP Practices Validation
- [ ] **Walking Skeleton**: First scenario implemented end-to-end before others
- [ ] **No Early Functionality**: No speculative components, no unused props, no extra routes
- [ ] **Self-Testing Code**: Every service and component has corresponding tests
- [ ] **Interface First**: Interfaces were defined in Stage 16 before implementation
- [ ] **Beautification Safe**: Styling did not change structure or break tests

#### 5. Adjacent Code Review
Run `/project:adjacent-code-review` against all pre-existing code the story touches:
- [ ] **List** all pre-existing files the story imports from or depends on
- [ ] **Architectural violations**: Old components bypassing service layer, missing interfaces
- [ ] **Naming drift**: Old code using different terms for the same domain concept
- [ ] **Duplicated logic**: Old code duplicating what new code provides (or vice versa)
- [ ] **Inconsistent patterns**: Old code in same module using different DI, state, or error handling patterns
- [ ] **Test quality debt**: Old tests that mock incorrectly or lack 3A structure
- [ ] **Security debt**: Unsanitized inputs, missing auth checks, exposed secrets
- Fix all issues found — do not just report them

#### 6. Accessibility & Web Interface Audit
Run the `web-design-guidelines` skill (under `.claude/skills/`; skip silently if absent) to audit every page and interactive component against the live Web Interface Guidelines. Its rule set is the single source for this check — covering accessibility (semantic HTML, ARIA, keyboard focus management, form labels, error announcements, WCAG-AA color contrast, alt text, heading hierarchy) plus interaction-state, layout, and motion correctness. Treat its findings as this stage's a11y/UX checklist and **fix every one** (per step 8 below) — do not merely report them.

If the skill is not installed, fall back to the WCAG-AA baseline: semantic HTML over `<div onClick>`, ARIA where native semantics fall short, full keyboard reachability and logical focus order (incl. after modal/route changes), labelled inputs, `role="alert"`/`aria-live` error announcements, 4.5:1 / 3:1 contrast with no color-only status, meaningful `alt`, and non-skipping heading levels.

#### 7. Dead Code Check (part of No Early Functionality)
- [ ] **No unused components**: Every component file is imported and rendered somewhere
- [ ] **No unused services/methods**: Every exported function is called somewhere
- [ ] **No unused interfaces/types**: Every exported type is referenced somewhere
- [ ] **No unused test files**: Every test file tests code that exists
- If dead code is found, **delete it immediately** — do not leave it "for future use"

#### 8. Fix ALL Issues Found (from steps 1–7)
Validation is not just reporting — **fix every issue before proceeding**:
- NEEDS_IMPROVEMENT and FAIL items must be fixed, not just noted
- Dead code must be deleted (components, tests, interfaces, props)
- Refactor ONLY within the story scope
- Ensure tests exist BEFORE refactoring
- Make small, safe transformations
- Run ALL tests after each fix (component tests + Playwright)
- Tests must stay green throughout
- Re-validate after fixes to confirm the issue is resolved

### Scoring
For each category: PASS / NEEDS_IMPROVEMENT / FAIL
- PASS: All checks satisfied
- NEEDS_IMPROVEMENT: Minor issues — **fix now**, then re-score as PASS
- FAIL: Must fix before proceeding

## Output
Write: `artifacts/{feature}/10-frontend-validation-report.md`
Include: what was found, what was fixed, and final score (all PASS after fixes).

## Done
Summarize:
- Score per category (after fixes)
- Issues found and how they were fixed
- Confirmation that all tests pass after fixes

Ask: "Review validation report. Type **continue** to proceed to Stage 25: Run E2E Integration."
