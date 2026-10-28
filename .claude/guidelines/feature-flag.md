# Feature Flag

## Purpose
Use feature flags (FeatBit) to safely introduce changes in brownfield systems. Hide incomplete or risky features behind flags to enable continuous integration without exposing unfinished work.

## Principles
- Always use a feature flag for brownfield changes.
- Prefer keystone interface pattern when possible (build backend fully, add UI last).
- Feature flags should be temporary — retire them once the feature is stable.
- Minimum toggle points: place flags at entry points only, not throughout code.

## Rules
- **DO**: Wrap new brownfield functionality in a FeatBit feature flag.
- **DO**: Place flag checks at the entry point (controller/route level).
- **DO**: Retire flags once the feature is stable and fully rolled out.
- **DO**: Test both flag-on and flag-off paths.
- **DON'T**: Scatter flag checks throughout the codebase.
- **DON'T**: Leave flags in place permanently (except ops toggles).
- **DON'T**: Use flags as an excuse to skip testing.

## When Is a Feature Flag Required?
```
Is this a brownfield change (modifying existing behavior)?
  YES → Feature flag REQUIRED (FeatBit)
  NO  → Feature flag optional but recommended for risky greenfield features
```

## Implementation
### 1. Create the Flag in FeatBit
```
Flag Key:    feature-{feature-name}
Default:     OFF (disabled)
Variations:  ON / OFF
Targeting:   Initially no one; add rules as you roll out
```

### 2. Place the Flag at the Entry Point ONLY
```typescript
// GOOD — flag at controller/route level
app.get('/api/orders', async (req, res) => {
  if (await featbit.isEnabled('feature-new-order-flow', user)) {
    return newOrderController.list(req, res)
  }
  return existingOrderController.list(req, res)
})

// BAD — flag scattered throughout code
class OrderService {
  async list() {
    const items = await this.repo.findAll()
    if (await featbit.isEnabled('feature-new-order-flow')) {  // DON'T
      items.forEach(i => i.newField = calculate())
    }
    return items
  }
}
```

### 3. Test Both Paths
```typescript
describe('Order list endpoint', () => {
  it('should use new flow when flag is enabled', async () => {
    mockFeatBit.isEnabled.mockResolvedValue(true)
    // ... test new behavior
  })

  it('should use existing flow when flag is disabled', async () => {
    mockFeatBit.isEnabled.mockResolvedValue(false)
    // ... test existing behavior
  })
})
```

### 4. Rollout Strategy
```
Deploy with flag OFF
  → Enable for developers/QA (internal)
  → Enable for 5% of users (canary)
  → Enable for 25%, 50%, 100% (gradual rollout)
  → Remove flag from code (cleanup!)
```

## Patterns
### Flag Types
| Type | Purpose | Lifetime | Dynamic? |
|------|---------|----------|----------|
| **Release** | Hide incomplete features | Days to weeks | Yes |
| **Experiment** | A/B testing | Weeks to months | Yes |
| **Ops** | Circuit breakers, kill switches | Permanent | Yes |
| **Permission** | Feature access control | Permanent | Yes |

### Keystone Interface Pattern
Build the entire feature backend-first, add UI last:
1. Build all backend code (integrated, tested) behind the feature flag.
2. Deploy — code is live but invisible (no UI entry point).
3. Test in production via API calls or internal tools.
4. Add the UI "keystone" — the simple toggle that exposes the feature — when ready to release.
5. No long-lived feature branch needed.

### Dark Launching
Test load and performance without user impact:
1. Call the new code path alongside the existing code path.
2. Compare results (new vs old) — log differences.
3. Users see only the old results.
4. When confident, switch to the new path.
