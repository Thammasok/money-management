---
description: Validator — verify layer architecture, DI, interface-first, humble object constraints.
user-invocable: false
---
# /project:validate-architecture

## Type
Validator Skill — run after development to verify architectural constraints.

## Purpose
Validate that the codebase follows the required layer architecture, dependency injection patterns, interface-first design, and humble object principles.

## Instructions

Read ALL source files for this feature. Trace the dependency graph. Check every item below.

### 1. Layer Architecture
Required layers (in dependency order). **Consult `.claude/tech-stack-profile.md` → Architecture Pattern** for the concrete layer names:
```
Entry Point → Business Logic → Domain (optional) → Data Access (optional) → External Integration (optional)
```

Check:
- [ ] Entry Point layer ONLY calls Business Logic (never Data Access or External Integration directly)
- [ ] Business Logic calls Data Access, External Integration, and domain objects
- [ ] Data Access handles storage ONLY (no business logic)
- [ ] External Integration handles external calls ONLY (no business logic)
- [ ] Domain objects contain business rules (no infrastructure concerns)
- [ ] No layer skipping (Entry Point calling Data Access directly)
- [ ] No reverse dependencies (Data Access importing Entry Point types)

**Report**: Draw the actual dependency graph. Flag any violations.

### 2. Dependency Injection
- [ ] All service dependencies injected via constructor
- [ ] Constructors do assignment only — no logic
- [ ] Dependencies are interfaces, not concrete classes
- [ ] No `new ConcreteClass()` inside services (except for domain/value objects)
- [ ] No service locator pattern
- [ ] No global singletons accessed directly

**Report**: List any class that creates its dependencies internally.

### 3. Interface-First Verification
- [ ] Entity interfaces/types exist for all domain objects
- [ ] DTO interfaces exist for all request/response types
- [ ] Business Logic interfaces exist for all service boundaries
- [ ] Data Access interfaces exist for all storage operations
- [ ] External Integration interfaces exist for all external service calls
- [ ] Real-Time interfaces exist (if applicable)
- [ ] Component prop interfaces exist (frontend)
- [ ] State model interfaces exist (frontend)
- [ ] API contract types exist (frontend)

**Report**: List any boundary missing an interface definition.

### 4. Humble Object Pattern
- [ ] Entry Points are thin (parse request → call business logic → return response)
- [ ] UI components are thin (receive props → render → fire callbacks)
- [ ] All business logic lives in Business Logic layer/presenters (testable layer)
- [ ] Infrastructure code (DB queries, external calls) isolated in Data Access/External Integration layers
- [ ] No complex conditionals in Entry Point or UI components

**Report**: List any "fat" Entry Point or component with logic that should be extracted.

### 5. Bounded Context
- [ ] Each module owns its data and domain model
- [ ] No shared internal models across module boundaries
- [ ] Cross-module communication goes through explicit interfaces
- [ ] Same domain concept in different contexts has different types

**Report**: List any boundary violations between contexts.

## Output Format
```markdown
# Architecture Validation Report

## Dependency Graph (use concrete layer names from tech-stack-profile)
```
Entry Point A → Business Logic A → Data Access A → Database
                                 → External Integration A → External API
```

## Summary
| Category | Status | Issues |
|----------|--------|--------|
| Layer Architecture | PASS/FAIL | N violations |
| Dependency Injection | PASS/FAIL | N violations |
| Interface-First | PASS/FAIL | N missing |
| Humble Object | PASS/FAIL | N fat objects |
| Bounded Context | PASS/FAIL | N violations |

## Overall: PASS / NEEDS_IMPROVEMENT / FAIL

## Violations (detailed)
### {category}
- {file}:{line} — {description} — Fix: {suggested fix}
```
