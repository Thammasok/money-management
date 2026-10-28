# Mockist Testing

## Purpose
Use interfaces and test doubles to isolate units under test, controlling the environment and verifying interactions between components.

## Principles
- Program to interfaces, not implementations.
- Mock every layer EXCEPT gateway and repository (these use real integration tests).
- Understand the difference between mocks, stubs, fakes, spies, and dummies.
- Behavior verification (mocks) vs state verification (stubs) — choose appropriately.

## Rules
- **DO**: Define interfaces for every service boundary.
- **DO**: Use test doubles for dependencies in unit tests.
- **DO**: Mock service → service interactions.
- **DO**: Use real implementations for gateway and repository tests (with docker-compose backing services).
- **DO**: Use contract tests to verify test doubles match real service behavior.
- **DON'T**: Mock the class under test — only mock its dependencies.
- **DON'T**: Mock gateway or repository layers — test these with real backing services.
- **DON'T**: Over-specify mock expectations (brittle tests).
- **DON'T**: Use mocks as an excuse to skip integration tests.

## Patterns
### Five Types of Test Doubles
| Type | Purpose | Behavior |
|------|---------|----------|
| **Dummy** | Fill parameter lists | No behavior, never actually called |
| **Fake** | Working implementation | Simplified (e.g., in-memory DB) |
| **Stub** | Provide canned answers | Returns predetermined responses |
| **Spy** | Record interactions | Stubs that also record calls |
| **Mock** | Verify expectations | Pre-programmed with expected calls |

### When to Use What (see tech-stack-profile → Architecture Pattern for concrete layer names)
- **Business Logic → Business Logic**: Mock the dependency, verify interaction
- **Business Logic → Data Access**: Use real Data Access with docker backing service
- **Business Logic → External Integration**: Use real External Integration with mock 3rd party (Mountebank)
- **Entry Point → Business Logic**: Mock Business Logic, verify request/response

### Mock vs Real Decision Matrix
| I'm testing... | I mock... | I keep real... |
|----------------|-----------|----------------|
| Entry Point (Controller) | Business Logic | HTTP framework, request/response parsing |
| Business Logic (Service) | Data Access, External Integration, Validator | Business logic, data transformation |
| Data Access (Repository) | NOTHING | Database (docker-compose) |
| External Integration (Gateway) | NOTHING | Mountebank mock 3rd party server |
| Validator | NOTHING | Validation logic |
| Component | Presenter/Service | Rendering, DOM interactions |
| Frontend Service | HTTP/fetch client | Service logic |

### Test Double Examples (illustrative — adapt to the project language)
**Dummy** — fills a parameter, never actually used:
```
dummyLogger = {} as Logger        // just satisfies the type
service = new Service(realRepo, dummyLogger)
```
**Stub** — returns canned answers:
```
stubRepo = { findById: (id) => ({ id, name: "John" }) }
```
**Spy** — records calls for later verification:
```
spyGateway = { sendEmail: fn() }
// ... after act ...
assert spyGateway.sendEmail called with ("user@test.com", "Welcome")
```
**Mock** — pre-programmed with expectations; verify both return AND interaction:
```
mockRepo = { save: fn() returns savedUser }
```
**Fake** — simplified working implementation:
```
class InMemoryUserRepo implements UserRepository {
  users = Map()
  save(user)     { users.set(user.id, user); return user }
  findById(id)   { return users.get(id) ?? null }
}
```

## Common Mistakes
- **Mocking what you don't own**: mock what you own (your own service interfaces). For external dependencies, use the real Mountebank mock server.
- **Over-specifying mocks**: don't assert on every call — only assert on interactions that matter for the behavior under test.
- **Mocking the class under test**: never. Only mock its dependencies.
- **Mocking repositories/gateways**: these should use real backing services — that's where integration bugs hide.
- **Not using contract tests**: when you stub an interface, ensure the stub matches real behavior via contract tests.
