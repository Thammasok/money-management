---
description: Consideration skill — place seams deliberately and keep a lot of behavior behind a small interface.
user-invocable: false
---
# /deep-modules

Read `.claude/guidelines/deep-modules.md` — the single source for this practice — and apply it to the current task.

Key reminders:
- Deep means a small interface over a lot of behavior; shallow means the interface costs as much as what it hides.
- The interface is everything a caller must know — invariants, ordering, error modes, config, performance — not just the signature.
- The mandated layer interfaces are required regardless; the two-adapter rule governs only seams added on top of them.
- Classify every dependency (in-process / local-substitutable / remote-but-owned / true-external) — the category fixes the test strategy.
- Apply the deletion test: a module that only moves complexity instead of concentrating it should not exist.
