---
description: Consideration skill — keep domain terms consistent across code, tests, docs, and scenarios.
user-invocable: false
---
# /ubiquitous-language

Read `.claude/guidelines/ubiquitous-language.md` — the single source for this practice — and apply it to the current task.

Key reminders:
- What the business calls it = what the code calls it = what the test calls it.
- Use domain terms, not technical jargon, for classes, methods, and variables (`placeOrder()`, not `submitData()`).
- Never use different names for the same concept across layers.
- Respect bounded contexts — the same word (e.g. "Account") can mean different things; don't force one class to serve all.
- Update the language (and the code) when the team's understanding of a term evolves.
