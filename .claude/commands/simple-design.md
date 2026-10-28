---
description: Consideration skill — never add functionality for the future; simplest design that satisfies current requirements.
user-invocable: false
---
# /simple-design

Read `.claude/guidelines/simple-design.md` — the single source for this practice — and apply it to the current task.

Key reminders:
- Run the YAGNI Test before writing code: if it isn't needed for a current scenario/story, don't build it.
- Prefer three similar lines over a premature abstraction; don't extract helpers or services for a handful of usages.
- No speculative parameters, options, or configurability "just in case."
- No error handling for cases that can't happen — trust boundary validation.
- Apply Kent Beck's four rules in priority order: passes tests, reveals intention, no duplication, fewest elements.
