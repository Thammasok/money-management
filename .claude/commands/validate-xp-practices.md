---
description: Validator — verify XP practices: feature flags, walking skeleton, small releases, no early functionality.
user-invocable: false
---
# /project:validate-xp-practices

## Type
Validator Skill — run after development to verify XP practices were followed.

## Purpose
Validate that all Extreme Programming practices enforced by this framework were followed: feature flags, walking skeleton, no early functionality, small releases, self-testing code, and interface-first development.

## Instructions

Review the full feature artifacts, code, tests, and git history. Check every item below.

### 1. Feature Flag (Brownfield)
If this was a brownfield change (modifying existing behavior):
- [ ] FeatBit feature flag exists for the new behavior
- [ ] Flag is placed at entry point only (controller/route level), not scattered
- [ ] Both flag-on and flag-off paths are tested
- [ ] Flag defaults to OFF (disabled)
- [ ] Flag key follows naming convention: `feature-{feature-name}`

If greenfield: mark as N/A.

### 2. Walking Skeleton
- [ ] The most important scenario was identified in `03-scenarios.md`
- [ ] That scenario was implemented FIRST (check git history — skeleton commits come before other scenarios)
- [ ] The skeleton touches all architectural layers end-to-end
- [ ] The skeleton has tests at every layer
- [ ] Remaining scenarios were implemented AFTER the skeleton was proven working
- [ ] Integration was set up BEFORE development (backing services, mock 3rd party)

### 3. No Early Functionality
- [ ] No unused functions, methods, or classes in the codebase
- [ ] No speculative parameters or configuration options
- [ ] No abstractions that serve only one implementation (premature abstraction)
- [ ] No error handling for scenarios that can't happen
- [ ] Every piece of code is exercised by a current scenario

**How to check**: For each function, trace back to a scenario that uses it. If no scenario uses it, it's early functionality.

### 4. Small Releases
- [ ] Work was broken into small tasks (check `07-development-plan.md`)
- [ ] Each task was reviewed before proceeding
- [ ] PRs were opened at task boundaries (check git/PR history)
- [ ] No mega-PRs that bundle multiple tasks

### 5. Self-Testing Code
- [ ] Every implementation file has a corresponding test file
- [ ] Running the test suite gives confidence that the code is correct
- [ ] Tests cover the important scenarios (not just happy path)
- [ ] A production bug would be caught by writing a failing test first, then fixing

### 6. Interface First
- [ ] Interface definitions were committed BEFORE implementation code (check git history)
- [ ] Backend: entities, DTOs, service interfaces, repository interfaces exist
- [ ] Frontend: API contracts, state models, component props, service interfaces exist
- [ ] Implementation files reference the interfaces (not defining their own ad-hoc types)

## Output Format
```markdown
# XP Practices Validation Report

## Summary
| Practice | Status | Evidence |
|----------|--------|----------|
| Feature Flag | PASS/FAIL/N/A | {flag key or reason for N/A} |
| Walking Skeleton | PASS/FAIL | {skeleton scenario name} |
| No Early Functionality | PASS/FAIL | {N unused items found} |
| Small Releases | PASS/FAIL | {N tasks, N PRs} |
| Self-Testing Code | PASS/FAIL | {coverage summary} |
| Interface First | PASS/FAIL | {N interfaces defined} |

## Overall: PASS / NEEDS_IMPROVEMENT / FAIL

## Issues (detailed)
### {practice}
- {description of violation} — Fix: {suggested fix}

## Recommendations
- {specific improvement}
```
