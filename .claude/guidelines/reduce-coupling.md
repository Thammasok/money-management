# Reduce Coupling

## Purpose
Minimize dependencies between components so that changes in one area don't ripple across the system. Loosely coupled systems are easier to test, modify, and deploy independently.

## Principles
- Depend on abstractions (interfaces), not concrete implementations.
- Bounded contexts define clear boundaries between domains.
- Published interfaces require more care than internal ones — changes affect external consumers.
- Three main decoupling strategies: interfaces, closures/functions, and notifications/events.

## Rules
- **DO**: Define clear boundaries between modules/services using interfaces.
- **DO**: Use events/notifications for cross-cutting concerns.
- **DO**: Keep bounded contexts separate — each owns its data and logic.
- **DO**: Pass functions/closures when full interface is overkill.
- **DON'T**: Share internal data structures across module boundaries.
- **DON'T**: Create circular dependencies between modules.
- **DON'T**: Change published interfaces without coordinating with consumers.
- **DON'T**: Couple modules through shared mutable state.

## Patterns
### Decoupling Strategies
| Strategy | When to Use | Example |
|----------|-------------|---------|
| **Interface** | Service boundary | `UserRepository` interface, swappable implementation |
| **Closure/Function** | Simple callback | Pass a `validate(data)` function instead of a validator object |
| **Event/Notification** | Cross-cutting | Publish `UserCreated` event, listeners react independently |

#### 1. Interfaces — expose only the contract, hide the implementation
```typescript
interface NotificationSender {
  send(to: string, message: string): Promise<void>
}

// Implementations can change without affecting consumers
class EmailNotificationSender implements NotificationSender { /* ... */ }
class SlackNotificationSender implements NotificationSender { /* ... */ }
```

#### 2. Closures / Functions — pass behavior when a full interface is overkill
```typescript
class OrderService {
  constructor(private validateOrder: (order: Order) => ValidationResult) {}
}

// Caller passes just the function
new OrderService((order) => ({ valid: order.total > 0 }))
```

#### 3. Events / Notifications — decouple publisher from subscriber
```typescript
// Publisher doesn't know who listens
eventBus.publish('OrderPlaced', { orderId: '123', total: 50 })

// Subscribers react independently
eventBus.subscribe('OrderPlaced', (event) => emailService.sendConfirmation(event))
eventBus.subscribe('OrderPlaced', (event) => inventoryService.reserve(event))
```

### Bounded Context
- Each context owns its domain model, data, and language.
- Communication between contexts goes through explicit contracts (APIs, events) — never shared internal models.
- Same real-world concept may have different representations in different contexts ("User" in auth ≠ "User" in billing).
- Published interfaces (cross-context) require more care than internal ones.

### Coupling Smell Checklist
- [ ] Can I change this module without changing others? (If no → too coupled)
- [ ] Does this module know about the internal structure of another? (If yes → too coupled)
- [ ] Are there circular dependencies? (If yes → refactor)
- [ ] Is shared mutable state being used for communication? (If yes → use events/interfaces)
