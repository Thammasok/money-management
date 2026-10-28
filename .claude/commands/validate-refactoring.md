---
description: Validator — verify refactoring was safe, test-covered, and story-scoped.
user-invocable: false
---
# /project:validate-refactoring

## Type
Validator Skill — run after development to verify refactoring was done safely.

## Purpose
Ensure all refactoring was safe: tests existed before changes, transformations were small, behavior was preserved, and scope was limited to the current story.

## Instructions

Review the git history and code changes for this feature. Check every item below.

### 1. Tests Before Refactoring
- [ ] Every refactored piece of code had existing tests BEFORE the refactoring commit
- [ ] No refactoring done on untested code
- [ ] Test files were NOT modified in the same commit as refactoring (tests should already pass)

**How to check**: Review git log — refactoring commits should not introduce new test files for the code being refactored (those tests should already exist from TDD).

### 2. Small Transformations
- [ ] Each refactoring step is a small, named transformation (Extract Method, Rename, Move, Inline, etc.)
- [ ] No "big bang" restructuring (rewriting entire files in one commit)
- [ ] Code remained working after each transformation (not broken for hours)
- [ ] Refactoring commits are separate from feature commits

**How to check**: Review git diff sizes — refactoring commits should be small and focused.

### 3. Behavior Preservation
- [ ] All tests pass after refactoring (same tests, same results)
- [ ] No test was modified to accommodate refactoring (if a test broke, the refactoring changed behavior)
- [ ] No new functionality was added during refactoring (two hats rule)
- [ ] Observable behavior is identical before and after

**How to check**: Run the full test suite. Compare test results before/after refactoring.

### 4. Scope Limited to Story
- [ ] Refactoring only touched code related to the current story/feature
- [ ] No "while I'm here" cleanup of unrelated code
- [ ] No speculative refactoring for future stories
- [ ] Refactoring was motivated by a concrete need (code smell, duplication, unclear naming)

**Report**: List any out-of-scope refactoring.

### 5. Refactoring vs Restructuring
Verify the changes are true refactoring (behavior-preserving transformations), NOT restructuring:

| Refactoring (OK) | Restructuring (NOT OK) |
|-------------------|----------------------|
| Extract Method | Rewrite from scratch |
| Rename | Change public API contract |
| Move to new file | Merge multiple services |
| Inline variable | Change database schema |
| Replace conditional with polymorphism | Switch framework |

- [ ] All changes are behavior-preserving transformations
- [ ] No restructuring disguised as refactoring

**Report**: Flag any restructuring that was labeled as refactoring.

## Output Format
```markdown
# Refactoring Validation Report

## Summary
| Category | Status | Issues |
|----------|--------|--------|
| Tests Before Refactoring | PASS/FAIL | N issues |
| Small Transformations | PASS/FAIL | N issues |
| Behavior Preservation | PASS/FAIL | N issues |
| Scope Limited | PASS/FAIL | N issues |
| True Refactoring | PASS/FAIL | N issues |

## Overall: PASS / NEEDS_IMPROVEMENT / FAIL

## Issues (detailed)
### {category}
- {commit hash} — {description of issue}

## Recommendations
- {specific improvement}
```
