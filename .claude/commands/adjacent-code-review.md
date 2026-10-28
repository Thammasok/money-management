---
description: Consideration skill — fix pre-existing issues in code the current story touches, within story scope.
user-invocable: false
---
# /project:adjacent-code-review

## Type
Consideration Skill — invoke during implementation or validation when pre-existing code in the story scope has issues.

## Purpose
Identify and fix problems in **pre-existing code that the current story touches or depends on**. New code should not work around old anti-patterns — it should fix them, within scope.

## Scope Rule
Only review code that the current story **directly interacts with**:
- Files the story imports from or calls into
- Modules the story shares a boundary with (same service, same component tree, same API route group)
- Shared utilities/helpers the story uses

Do NOT refactor code outside this boundary — that is "while I'm here" cleanup and violates story scope.

## What to Look For

### 1. Architectural Violations
Pre-existing code that breaks the enforced layer architecture (see tech-stack-profile → Architecture Pattern):
- Component that calls an API directly (bypasses Business Logic layer)
- Business Logic that imports a concrete Data Access instead of an interface
- Entry Point that contains business logic instead of delegating to Business Logic layer
- Direct storage operations outside the Data Access layer

**Fix**: Introduce the missing layer or interface. Move logic to the correct layer.

### 2. Missing Interfaces
Pre-existing code at a boundary that has no interface:
- Business Logic with no corresponding interface file
- Data Access used by injection token but no interface defined
- Component props defined inline instead of in a shared types file

**Fix**: Extract interface. Update DI registration to use the interface.

### 3. Naming Drift
Pre-existing code that uses different terms for the same domain concept:
- "booking" vs "reservation" for the same thing
- "room" vs "area" vs "zone" for the same thing
- "customer" vs "client" vs "guest" inconsistently
- Method names that don't match the ubiquitous language

**Fix**: Rename to match the ubiquitous language. Update all references.

### 4. Duplicated Logic
Pre-existing code that duplicates something the new story provides (or vice versa):
- Old validation logic duplicated in the new story's service
- Old helper function that does the same thing as a new utility
- Same API call made in two different services

**Fix**: Consolidate into one location. Delete the duplicate.

### 5. Inconsistent Patterns
Pre-existing code in the same module that uses a different pattern than the new code:
- Old code uses callbacks where new code uses async/await
- Old code uses a different state management approach
- Old code mocks at the wrong layer in tests
- Old code has no error handling where new code does
- Old code uses a different DI mechanism

**Fix**: Align old code to the pattern established by the new code (or the project standard).

### 6. Test Quality Debt
Pre-existing tests in the story scope that don't meet current standards:
- Tests without 3A structure
- Tests that mock at the wrong layer
- Tests that depend on execution order
- Tests with hardcoded waits instead of proper async handling
- Tests for deleted/renamed code (orphaned tests)

**Fix**: Rewrite tests to match current standards. Delete orphaned tests.

### 7. Security Debt
Pre-existing code in the story scope with security issues:
- Unsanitized user input passed to queries
- Secrets or tokens logged or exposed
- Missing authorization checks on endpoints the story depends on
- Deprecated or vulnerable dependency used by story code

**Fix**: Apply the fix. If the fix is too large for the current story, document it as a follow-up but still flag it.

## How to Apply

### During Implementation (Stages 12, 17-19)
When you encounter pre-existing code that has one of the above issues:
1. Note the issue
2. Finish the current implementation task
3. Fix the adjacent code issue as a separate step
4. Ensure existing tests still pass
5. If no tests exist for the old code, write them first (then fix)

### During Validation (Stages 14, 24)
Systematically scan all code the story interacts with:
1. List all pre-existing files the story imports from or depends on
2. Check each file against the checklist above
3. Fix issues found — do not just report them
4. Re-run all tests after each fix

## Constraints
- Only fix code within the story boundary — no unrelated cleanup
- Tests must exist before fixing (write them first if missing)
- Small, safe transformations only — follow `/project:validate-refactoring` guidelines
- All tests must stay green after each fix
- If a fix would be too disruptive (e.g., requires changing a shared API contract used by other features), document it as technical debt and flag it to the team — do not silently skip it
