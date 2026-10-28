# Dependency Injection

## Purpose
Separate configuration from use. Make dependencies explicit, swappable, and testable by injecting them rather than constructing them internally.

## Principles
- Constructor injection is preferred — makes dependencies explicit and enables immutability.
- Dependencies should be injected, not created internally.
- Inversion of Control: the framework/container wires components, not the application code.
- Humble Object pattern: move hard-to-test logic out of difficult-to-test environments (UI, infrastructure).

## Rules
- **DO**: Use constructor injection for required dependencies.
- **DO**: Define interfaces for all service boundaries.
- **DO**: Keep constructors focused on assignment — no logic.
- **DO**: Apply Humble Object pattern: UI elements delegate to testable objects.
- **DON'T**: Create dependencies inside a class (use `new` for domain objects only).
- **DON'T**: Use service locator as a replacement for DI (it hides dependencies).
- **DON'T**: Put business logic in hard-to-test places (controllers, UI components).

## Patterns
### Constructor Injection
```
class UserService
  constructor(userRepository: UserRepository, emailGateway: EmailGateway)
    // Dependencies are injected, not created internally
    this.userRepository = userRepository
    this.emailGateway = emailGateway
```

Constructor injection makes dependencies explicit and required, and lets you
swap implementations between test and production without touching the class:

```typescript
class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository,    // interface
    private readonly paymentGateway: PaymentGateway, // interface
    private readonly emailService: EmailService      // interface
  ) {}

  async placeOrder(input: PlaceOrderInput): Promise<Order> {
    const order = await this.orderRepo.save(Order.create(input))
    await this.paymentGateway.charge(order.total, input.paymentMethod)
    await this.emailService.sendConfirmation(order)
    return order
  }
}

// In test — inject mocks
const service = new OrderService(mockRepo, mockPayment, mockEmail)

// In production — inject real implementations
const service = new OrderService(pgOrderRepo, stripeGateway, sendgridEmail)
```

### Humble Object
```
// Hard to test (UI component)
class LoginForm
  constructor(presenter: LoginPresenter)
  onSubmit()
    presenter.handleLogin(this.getFormData())

// Easy to test (pure logic)
class LoginPresenter
  handleLogin(data) -> result
    // All testable business logic lives here
```

Move logic OUT of hard-to-test environments. The component becomes humble —
it only renders; all branching/sorting/filtering lives in a testable presenter:

```typescript
// BAD — logic trapped in UI component (hard to test)
function OrderPage() {
  const [orders, setOrders] = useState([])
  useEffect(() => {
    fetch('/api/orders')
      .then(r => r.json())
      .then(data => {
        const sorted = data.sort((a, b) => b.date - a.date)
        const filtered = sorted.filter(o => o.status !== 'cancelled')
        setOrders(filtered)
      })
  }, [])
  // ... render
}

// GOOD — logic in testable presenter, UI is humble
class OrderPresenter {
  constructor(private api: OrderApi) {}

  async getActiveOrders(): Promise<Order[]> {
    const orders = await this.api.fetchOrders()
    return orders
      .sort((a, b) => b.date - a.date)
      .filter(o => o.status !== 'cancelled')
  }
}

// Component is humble — just renders
function OrderPage({ presenter }: { presenter: OrderPresenter }) {
  const [orders, setOrders] = useState([])
  useEffect(() => { presenter.getActiveOrders().then(setOrders) }, [])
  return orders.map(o => <OrderCard key={o.id} order={o} />)
}
```

### Layer Dependency Direction
Dependencies always point INWARD (toward domain logic); infrastructure sits at
the edges. Each layer depends on the *interface* of the next, never the concrete.

```
Controller → depends on → Service interface
Service    → depends on → Repository interface, Gateway interface
Repository → depends on → Database (infrastructure)
Gateway    → depends on → External API (infrastructure)
```
