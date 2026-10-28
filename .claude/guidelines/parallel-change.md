# Parallel Change (Expand-Migrate-Contract)

## Purpose
Safely introduce backward-incompatible changes by supporting both old and new versions simultaneously, migrating consumers gradually, then removing the old version.

## Principles
- Never break existing consumers with a change.
- Three phases: Expand (support both), Migrate (move consumers), Contract (remove old).
- Branch by Abstraction enables large-scale replacements through an abstraction layer.

## Rules
- **DO**: Add the new version alongside the old (expand phase).
- **DO**: Migrate consumers one at a time to the new version.
- **DO**: Remove the old version only after all consumers have migrated (contract phase).
- **DO**: Use branch by abstraction for large replacements.
- **DON'T**: Remove the old version before all consumers are migrated.
- **DON'T**: Make breaking changes without a migration path.
- **DON'T**: Skip the contract phase — old code left behind becomes technical debt.

## Patterns
### Three Phases
```
1. EXPAND:   Add new interface/behavior alongside existing
             Both old and new work simultaneously

2. MIGRATE:  Update consumers one by one to use new version
             Run both versions, verify each migration

3. CONTRACT: Remove old interface/behavior
             Clean up deprecated code
```

Example through the three phases (a service interface gaining a richer return type):
```
// EXPAND — both versions work, no consumer broken; deploy and verify
interface UserService:
  getUser(id)    → User         // existing
  getUserV2(id)  → UserDetail   // new (expanded)

// MIGRATE — move consumers one at a time, test after each
consumerA: userService.getUserV2(id)   // migrated
consumerB: userService.getUser(id)     // still on V1 (next)

// CONTRACT — only after ALL consumers migrated; deploy and verify
interface UserService:
  getUser(id) → UserDetail   // V2 renamed to standard; V1 removed
```

### Branch by Abstraction
```
1. Create abstraction layer:        Client → [Abstraction] → Old Implementation
2. Move all clients to abstraction: All usage goes through the abstraction
3. Build new implementation:        [Abstraction] → Old AND New available
4. Switch:                          [Abstraction] → New Implementation
5. Clean up:                        Remove old implementation and abstraction
```

## When to Use
- **Expand-Migrate-Contract**: API changes, interface changes, data format changes.
- **Branch by Abstraction**: replacing libraries, large component rewrites, framework migrations.
- **Neither needed**: internal changes with no external consumers — just refactor directly.
