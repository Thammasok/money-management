# Deep Modules and Seams

## Purpose
Decide **where the seams go** and **how much behavior sits behind each interface**. The layer architecture already fixes the *roles* a system has (Entry Point → Business Logic → Data Access → External Integration); it does not say how many modules there are, where one ends, or which dependencies deserve a port. That is this practice.

This is **reference consulted while designing**, not a process to run. It is used at plan time to name modules and place seams — never to design method signatures, which belongs to Stage 11 / Stage 16.

Neighbours that already own their topic, and are not restated here: `.claude/guidelines/dependency-injection.md` (injection, humble object, dependency direction), `.claude/guidelines/reduce-coupling.md` (bounded contexts, decoupling strategies, coupling smells), `.claude/guidelines/interface-first.md` (defining interfaces before implementation).

## Principles
- **Module** — anything with an interface and an implementation: a function, a class, a package, a tier-spanning slice. Deliberately scale-agnostic.
- **Interface** — everything a caller must know to use it correctly: the type signature, *plus* invariants, ordering constraints, error modes, required configuration, and performance characteristics.
- **Depth** — leverage at the interface: how much behavior a caller gets per unit of interface they must learn. Deep = small interface, lots of behavior. Shallow = interface nearly as complex as the implementation.
- **Seam** — the place where behavior can be altered without editing in that place; the *location* of an interface. Where to put it is its own decision, separate from what goes behind it.
- **Adapter** — a concrete thing satisfying an interface at a seam. Describes the role it fills, not what is inside it.
- Depth buys **leverage** for callers (one implementation pays back across N call sites) and **locality** for maintainers (change and bugs concentrate in one place).

## Rules
- **DO**: Prefer a small interface over a small implementation — hide complexity, don't spread it.
- **DO**: Apply the deletion test before keeping a module: would deleting it concentrate complexity, or just move it?
- **DO**: Justify every seam added *beyond* the mandated layer interfaces with two adapters. One adapter means a hypothetical seam; two means a real one.
- **DO**: Classify each dependency into a category before deciding its test strategy (see Dependency Categories).
- **DO**: Name the seam the acceptance suite drives, and agree it before any test is planned.
- **DON'T**: Add a seam on top of the layer interfaces until something actually varies across it — a single-adapter seam is just indirection.
- **DON'T**: Expose a module's internal seams through its interface because its own tests use them.
- **DON'T**: Design past the interface. If a test must reach inside, the module is the wrong shape.
- **DON'T**: Add a module because a layer name exists — layers are roles, not a quota.

## Patterns
### Deep vs Shallow
```
DEEP — small interface, lots of implementation (aim here)
┌─────────────────────┐
│   Small Interface   │  few entry points, simple params
├─────────────────────┤
│  Deep Implementation│  complex logic hidden
└─────────────────────┘

SHALLOW — large interface, thin implementation (avoid)
┌─────────────────────────────────┐
│       Large Interface           │  many methods, complex params
├─────────────────────────────────┤
│  Thin Implementation            │  just passes through
└─────────────────────────────────┘
```
When designing an interface, ask: can I remove an entry point? Can I simplify the parameters? Can I hide more behind it?

### The Two-Adapter Rule Does Not Override Interface First
The layer-boundary interfaces this project mandates — Entry Point ↔ Business Logic ↔ Data Access ↔ External Integration, per `.claude/guidelines/interface-first.md` and the Architecture Constraints in `CLAUDE.md` — are **not** subject to the two-adapter test. Under this harness's mockist policy they already have two adapters by construction: the production implementation and the test double every unit test substitutes. They are required regardless.

The two-adapter rule governs the seams you are thinking of adding **on top of** those: an extra port, a strategy interface, an abstraction layer introduced "for flexibility". That is where a single adapter means indirection.

### Dependency Categories
The category fixes the seam decision and the test strategy, and lines up with the layer roles in `.claude/tech-stack-profile.md` → Architecture Pattern.

| Category | What it is | Extra seam beyond the layer interface? | How it is tested here |
|---|---|---|---|
| **In-process** | Pure computation, in-memory state, no I/O | No | Directly through the module's interface |
| **Local-substitutable** | Real thing runs locally (database, cache, queue) | No — the Data Access interface is the seam | **Real**, via `docker-compose.backing-service.yml`. This is why Data Access is not mocked in integration tests |
| **Remote but owned** | Our own services across a network | Only if the transport genuinely varies | **Real mock** at the External Integration boundary — a Mountebank impostor, same as any other remote call. Being ours changes who can amend the contract, not how it is tested |
| **True external** | Third-party APIs we don't control | Only if you need to swap providers | **Real mock** — Mountebank impostor in tests; real client in production |

### The Deletion Test
Imagine the module gone. If complexity vanishes with it, it was a pass-through — delete it. If complexity reappears spread across N callers, it was earning its keep — keep it and consider giving it more.

### The Interface Is the Test Surface
Callers and tests cross the same seam. Tests assert on observable outcomes through the interface, never on internal state, so they survive refactors. When a deep module replaces several shallow ones, the old unit tests on the shallow parts become waste — replace them, don't layer new tests on top.

### Design It Twice
**Runs at Stage 11 / Stage 16**, when a module's interface is actually being designed — not at epic-plan time, where only the module and its seam get named.

Your first interface is unlikely to be the best. For a load-bearing module, dispatch three subagents in parallel, each with a different constraint, then compare and recommend:
- **Minimize the interface** — 1–3 entry points, maximum leverage each.
- **Maximize flexibility** — many use cases and extension points.
- **Optimize the common caller** — make the default case trivial.

Each returns: the interface (with invariants, ordering, error modes), a usage example, what it hides, its adapter strategy, and where its leverage is thin. Compare on **depth**, **locality**, and **seam placement**, then give one opinionated recommendation — a hybrid if two designs combine well.

### Seam Checklist
- [ ] What varies across this seam? Name both adapters.
- [ ] Which dependency category is behind it?
- [ ] What does a caller have to know beyond the signature?
- [ ] Would deleting this module concentrate complexity or scatter it?
- [ ] Can the acceptance suite drive this seam without reaching past it?

## Warning Signs
- A module whose interface is nearly as complex as what it hides.
- A port with exactly one implementation and no second one in sight.
- Understanding one concept requires bouncing between many small modules.
- Functions extracted purely for testability while the real bugs live in how they are called.
- Tests that must change whenever the implementation changes.

---

Adapted for this harness from the `codebase-design` skill in [mattpocock/skills](https://github.com/mattpocock/skills) — MIT License, Copyright (c) 2026 Matt Pocock.
