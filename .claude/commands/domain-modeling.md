---
description: Consideration skill — build the domain model actively: one canonical term per concept, the rest banned.
user-invocable: false
---
# /domain-modeling

Read `.claude/guidelines/domain-modeling.md` — the single source for this practice — and apply it to the current task.

Key reminders:
- Pick one canonical name per concept and list every displaced word under `_Avoid_`.
- Treat vague nouns ("account", "item", "status") as two concepts until proven otherwise.
- Stress-test each relationship with a concrete edge-case scenario the user must answer.
- Check stated behavior against the code and surface the contradiction before either changes.
- The glossary is a glossary — no endpoints, no acceptance criteria, and never unreviewed by the user.
