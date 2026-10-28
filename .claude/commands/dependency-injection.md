---
description: Consideration skill — constructor injection, interface segregation, humble object patterns.
user-invocable: false
---
# /dependency-injection

Read `.claude/guidelines/dependency-injection.md` — the single source for this practice — and apply it to the current task.

Key reminders:
- Inject dependencies via the constructor; never `new` a dependency inside a class (domain objects excepted).
- Depend on interfaces, not concrete classes — one interface per boundary.
- Keep constructors to assignment only; no business logic.
- Apply the Humble Object pattern — move logic out of UI/infrastructure into testable presenters/services.
- Dependencies point inward toward domain logic; infrastructure stays at the edges.
