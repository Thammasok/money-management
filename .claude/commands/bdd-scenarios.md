---
description: Consideration skill — write BDD scenarios in Given/When/Then using ubiquitous language.
user-invocable: false
---
# /project:bdd-scenarios

## Type
Consideration Skill — invoke anytime during development for guidance.

## Purpose
Guide the developer or QA through writing BDD scenarios in Given/When/Then format using ubiquitous language.

## When to Invoke
- When writing scenarios from requirements
- When unsure how to structure a scenario
- When scenarios are too technical or too vague

## Instructions

Read `guidelines/bdd-scenarios.md` for the full practice.

### Scenario Structure
```
Scenario: {Descriptive name that explains the behavior}
  Given {precondition — the world before the action}
    And {additional precondition if needed}
  When {action — what the user or system does}
    And {additional action if needed}
  Then {outcome — what should be true after}
    And {additional outcome if needed}
```

### Writing Good Scenarios

#### 1. Start with the Happy Path
The most common, successful user journey:
```
Scenario: Customer places order with valid payment
  Given a customer with items in their cart
  And a valid credit card on file
  When the customer clicks "Place Order"
  Then the order is created with status "confirmed"
  And a confirmation email is sent to the customer
  And the inventory is updated
```

#### 2. Add Edge Cases
Boundary conditions and unusual but valid paths:
```
Scenario: Customer places order with exactly $0 balance after discount
  Given a customer with items totaling $50
  And a discount code worth $50
  When the customer applies the discount and clicks "Place Order"
  Then the order is created with $0 charged
  And no payment transaction is created
```

#### 3. Add Error Cases
What happens when things go wrong:
```
Scenario: Customer cannot place order with expired card
  Given a customer with items in their cart
  And an expired credit card on file
  When the customer clicks "Place Order"
  Then the order is NOT created
  And an error message "Payment card has expired" is displayed
  And the customer is prompted to update their card
```

### Language Rules
- **DO**: Use domain language ("customer places order", not "user submits POST request")
- **DO**: Name concrete values ("$50 discount", not "some discount")
- **DO**: One behavior per scenario
- **DON'T**: Reference UI elements in Given/When/Then ("clicks the blue button")
- **DON'T**: Reference database operations ("a row is inserted into orders table")
- **DON'T**: Combine multiple behaviors in one scenario

### Coverage Checklist
For each requirement/acceptance criterion:
- [ ] Happy path scenario exists
- [ ] Relevant edge cases covered
- [ ] Error/failure cases covered
- [ ] Walking skeleton scenario marked

### Turning Scenarios into Tests
Each scenario maps to:
- A Playwright E2E test (full user flow)
- One or more unit tests (business logic within the scenario)
- API test cases (Bruno) for backend endpoints involved
