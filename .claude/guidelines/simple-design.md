# Simple Design (YAGNI)

## Purpose
Keep code as simple as possible. Never add functionality for the future. The simplest design that works is the best design.

## Principles
- 90% of speculative features are never used — building them wastes 90% of time.
- Extra features increase complexity without value.
- Simple code is easier to modify when real requirements emerge.
- Good design maintains productivity; complexity kills it (design stamina hypothesis).

## Rules
- **DO**: Implement only what is needed for the current scenario/story.
- **DO**: Keep solutions as small and focused as possible.
- **DO**: Delete code that is no longer used.
- **DO**: Prefer three similar lines over a premature abstraction.
- **DON'T**: Add features, parameters, or configurability "just in case."
- **DON'T**: Build abstractions for hypothetical future requirements.
- **DON'T**: Add error handling for scenarios that can't happen.
- **DON'T**: Over-engineer — the right amount of complexity is the minimum needed.

## Patterns
### Four Rules of Simple Design (Kent Beck)
1. Passes all the tests
2. Reveals intention (clear, readable)
3. No duplication (DRY, but don't force it prematurely)
4. Fewest elements (classes, methods, lines)

### Decision Checklist (the YAGNI Test)
Before writing any code, ask in order:
1. Is this needed for a current scenario/story? If no → don't build it.
2. Can I solve this with less code? If yes → simplify.
3. Am I adding this for a hypothetical future need? If yes → stop.
4. Is this abstraction justified by current usage? If no → use concrete code.

### Concrete Examples

**Three similar lines beat a premature abstraction:**
```
// Fine — don't extract a helper for 3 usages
userAge   = calculateAge(user.birthDate)
spouseAge = calculateAge(spouse.birthDate)
childAge  = calculateAge(child.birthDate)
// DON'T create a FamilyAgeCalculatorService for this
```

**No speculative parameters:**
```
// BAD — options nobody asked for
createUser(data, options?: { sendEmail, notifyAdmin, auditLog })

// GOOD — only what's needed now
createUser(data)
```

**No early error handling for impossible cases:**
```
// BAD — this is only called from an already-validated boundary
processOrder(order):
  if order is null      → throw   // can't happen
  if order.items is null → throw   // can't happen
  if order.items empty   → throw   // can't happen
  // actual logic...

// GOOD — trust the boundary validation
processOrder(order):
  // actual logic directly
```

### Design Stamina
Good design MAINTAINS development speed; poor design ACCUMULATES debt that slows you down. But the payoff line is weeks, not days — don't over-design for a feature that ships this week.
