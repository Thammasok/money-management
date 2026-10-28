---
description: Consideration skill — structure every test as Arrange/Act/Assert.
user-invocable: false
---
# /3a-pattern

Read `.claude/guidelines/3a-pattern.md` — the single source for this practice — and apply it to the current task.

Key reminders:
- Keep the three phases visually distinct (blank lines or comments) so each test reads cleanly.
- Act is exactly ONE action (1-2 lines); a second act means it's two tests.
- Don't do arrangement inside the Assert phase — define expected values up front.
- Each test has exactly one reason to fail; multiple related assertions on one behavior are fine.
- When stuck, write the assertion first, then the action, then the setup.
