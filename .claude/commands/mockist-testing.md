---
description: Consideration skill — isolate units with interfaces and test doubles; what to mock vs keep real.
user-invocable: false
---
# /mockist-testing

Read `.claude/guidelines/mockist-testing.md` — the single source for this practice — and apply it to the current task.

Key reminders:
- Mock every layer EXCEPT Data Access (real DB via docker-compose) and External Integration (real Mountebank mock 3rd party).
- Never mock the class under test — only its dependencies.
- Don't over-specify mock expectations; assert only on interactions that matter for the behavior.
- Mock what you own; for external dependencies use the real mock server, not hand-rolled stubs.
- Back stubbed interfaces with contract tests so doubles stay faithful to real behavior.
