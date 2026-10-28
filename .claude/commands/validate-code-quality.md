---
description: Validator — check for code smells, coupling, duplication, technical debt.
user-invocable: false
---
# /project:validate-code-quality

## Type
Validator Skill — run after development to verify code quality.

## Purpose
Check for code smells, data clumps, excessive coupling, technical debt, and duplication in the codebase.

## Instructions

Read ALL source files changed for this feature. For each file, check every item below.

### 1. Code Smells
Scan for common smells:
- [ ] **Long methods**: Any function > 20 lines should be scrutinized (not a hard rule, but a smell)
- [ ] **Large classes**: Classes with too many responsibilities
- [ ] **Feature envy**: Method uses more data from another class than its own
- [ ] **Primitive obsession**: Using primitives where a value object would be clearer
- [ ] **Switch statements**: Long switch/if-else chains that should be polymorphism
- [ ] **Speculative generality**: Abstractions, parameters, or hooks that nothing uses

**Report**: List each smell with file:line, smell name, and suggested fix.

### 2. Data Clumps
- [ ] Same group of primitives appearing together in multiple places
- [ ] Multiple parameters that always travel together
- [ ] Same field combinations across different classes

Example:
```
// SMELL: startDate/endDate always together
function getReport(startDate, endDate) { ... }
function filterOrders(startDate, endDate) { ... }
function calculateRevenue(startDate, endDate) { ... }

// FIX: Extract DateRange value object
function getReport(range: DateRange) { ... }
```

**Report**: List data clumps found and suggest extraction.

### 3. Coupling Analysis
- [ ] Services depend on interfaces, not concrete implementations
- [ ] No circular dependencies between modules
- [ ] No shared mutable state between modules
- [ ] Published interfaces are minimal (expose only what consumers need)
- [ ] Import graph shows clear layer direction (controller → service → repo)

**Report**: List coupling violations with dependency diagram.

### 4. Duplication
- [ ] No copy-pasted logic blocks (> 3 lines identical)
- [ ] No near-duplicates (same structure with minor variations)
- [ ] No duplicated constants or configuration values
- [ ] Test utilities are shared where appropriate (Object Mother pattern)

**Report**: List duplications with file locations and suggested deduplication.

### 5. Technical Debt
- [ ] No TODO/FIXME/HACK comments without associated tracking
- [ ] No commented-out code
- [ ] No workarounds that should be proper fixes
- [ ] No shortcuts taken "to save time" that will cost more later
- [ ] Error handling is appropriate (not swallowing errors, not over-handling)

**Report**: List debt items with severity and remediation suggestion.

### 6. Naming (Ubiquitous Language)
- [ ] Class/function/variable names use domain language
- [ ] No ambiguous abbreviations
- [ ] Consistent naming across the codebase
- [ ] Names reveal intention

**Report**: List naming violations.

## Output Format
```markdown
# Code Quality Validation Report

## Summary
| Category | Status | Issues |
|----------|--------|--------|
| Code Smells | PASS/FAIL | N issues |
| Data Clumps | PASS/FAIL | N issues |
| Coupling | PASS/FAIL | N issues |
| Duplication | PASS/FAIL | N issues |
| Technical Debt | PASS/FAIL | N items |
| Naming | PASS/FAIL | N issues |

## Overall: PASS / NEEDS_IMPROVEMENT / FAIL

## Issues (detailed)
### {category}
- {file}:{line} — {description} — Suggested fix: {fix}

## Refactoring Recommendations
(Only within story scope, only with tests in place)
- {specific refactoring with before/after}
```
