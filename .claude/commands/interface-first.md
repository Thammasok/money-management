---
description: Consideration skill — define interfaces (entity, DTO, model, contracts) before any implementation.
user-invocable: false
---
# /project:interface-first

## Type
Consideration Skill — invoke anytime during development for guidance.

## Purpose
Remind the developer to define interfaces (entity, DTO, model, contracts) BEFORE writing any implementation. This applies to both frontend and backend.

## When to Invoke
- Before starting implementation of any new feature or component
- When tempted to write code before defining the contract
- During code review to verify interfaces exist

## Instructions

Read `guidelines/interface-first.md` for the full practice.

### Implementation Sequence
```
1. Define interfaces    ← YOU ARE HERE (before writing any code)
2. Write tests          ← Tests program against interfaces
3. Write implementation ← Code implements interfaces
4. Refactor             ← Interfaces stay stable, implementation improves
```

### Backend Interface Checklist
Before writing any backend code, define:
- [ ] **Entities**: Domain object shapes
- [ ] **DTOs**: Request DTOs, Response DTOs, Internal DTOs
- [ ] **Service interface**: Public methods with input/output types
- [ ] **Repository interface**: Data access methods
- [ ] **Gateway interface**: External service call methods (if applicable)
- [ ] **Validator interface**: Validation methods (if applicable)

### Frontend Interface Checklist
Before writing any frontend code, define:
- [ ] **API contract types**: Request/response matching backend exactly
- [ ] **State model**: Application state shape
- [ ] **Service interface**: Data access and logic methods
- [ ] **Component props**: Input/output for each component
- [ ] **Event types**: Component communication events (if applicable)

### Why This Matters
```
Without interfaces first:
  Developer A builds service → Developer B builds controller
  → They discover mismatched types at integration time → Rework

With interfaces first:
  Both developers agree on interfaces first
  → Developer A builds service against interface
  → Developer B builds controller against same interface
  → They integrate seamlessly
```

### Interfaces Enable Mockist Testing
```typescript
// Interface defined first
interface OrderRepository {
  save(order: Order): Promise<Order>
  findById(id: string): Promise<Order | null>
}

// Test can be written IMMEDIATELY using the interface
const mockRepo: OrderRepository = {
  save: jest.fn().mockResolvedValue(testOrder),
  findById: jest.fn().mockResolvedValue(testOrder),
}

// Implementation comes later — tests already exist
class PgOrderRepository implements OrderRepository { /* ... */ }
```
