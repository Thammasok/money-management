---
description: Consideration skill — TDD: failing test, minimum code to pass, refactor.
user-invocable: false
---
# /test-first

Read `.claude/guidelines/test-first.md` — the single source for this practice — and apply it to the current task.

Key reminders:
- Never write implementation before a failing test demands it; skipping RED means the test proves nothing.
- Write the minimum code to go green — no gold-plating for the future.
- Wear one hat at a time: add behavior OR refactor, never both at once.
- During RED/GREEN run only the single test file; never run full suites — the test gate does that when the track finishes.
- Test behavior at the boundary, not implementation details.
