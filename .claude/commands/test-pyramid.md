---
description: Consideration skill — keep proportions: many unit, some integration, few E2E tests.
user-invocable: false
---
# /test-pyramid

Read `.claude/guidelines/test-pyramid.md` — the single source for this practice — and apply it to the current task.

Key reminders:
- Keep the proportions: ~70% unit, ~20% component, few API integration, ~3% E2E.
- Push each test to the lowest level that can catch the bug; don't test logic at E2E that a unit test covers.
- Watch for the ice-cream-cone anti-pattern (more E2E than unit) — extract logic down into unit/component tests.
- Reserve E2E (Playwright) for critical user journeys only; they are slow and can be flaky.
- Use the decision flow to pick the test type before writing it.
