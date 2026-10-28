---
description: Consideration skill — implement FeatBit feature flags for brownfield changes.
user-invocable: false
---
# /feature-flag

Read `.claude/guidelines/feature-flag.md` — the single source for this practice — and apply it to the current task.

Key reminders:
- Every brownfield change (modifying existing behavior) REQUIRES a FeatBit flag, default OFF.
- Place flag checks at the entry point (controller/route) only — never scatter them through services.
- Test both paths: flag-on (new behavior) and flag-off (existing behavior).
- Roll out gradually (internal → canary → 100%), then remove the flag from code.
- Prefer the keystone-interface pattern: build the backend fully behind the flag, add the UI last.
