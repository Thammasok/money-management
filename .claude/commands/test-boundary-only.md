---
description: Consideration skill — test public boundaries only; tests independent, no shared state.
user-invocable: false
---
# /test-boundary-only

Read `.claude/guidelines/test-boundary-only.md` — the single source for this practice — and apply it to the current task.

Key reminders:
- Test the public boundary (input → output + observable effects), never private methods or internal steps.
- Don't add test-only methods that expose internals; if a test breaks on refactor, it was testing implementation.
- Cover valid input, invalid input, and edge cases — not every possible case.
- Every test must be independent: sets up its own data, no shared state, no execution-order dependency.
- Each test must pass alone, in any order, and in parallel.
