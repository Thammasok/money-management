---
description: Consideration skill — minimize dependencies using interfaces, closures, events, bounded contexts.
user-invocable: false
---
# /reduce-coupling

Read `.claude/guidelines/reduce-coupling.md` — the single source for this practice — and apply it to the current task.

Key reminders:
- Depend on abstractions (interfaces), not concrete implementations.
- Pass a closure/function when a full interface is overkill; use events to decouple publisher from subscriber.
- Never share internal data structures or mutable state across module boundaries.
- Keep bounded contexts separate — each owns its data, model, and language; communicate via explicit contracts.
- Run the coupling-smell checklist: no ripple changes, no circular deps, no reaching into another module's internals.
