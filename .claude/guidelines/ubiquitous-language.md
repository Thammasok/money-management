# Ubiquitous Language

## Purpose
Build and maintain a common vocabulary between developers, QA, and business stakeholders. The same terms used in conversation should appear in code, tests, and documentation.

## Principles
- Language is based on the domain model, not technical implementation.
- Terms must be tested with domain experts — if they don't recognize a term, it's wrong.
- Language evolves with understanding — update code when language changes.
- Beware semantic diffusion: terms losing meaning as they spread without discipline.

## Rules
- **DO**: Use domain terms in code (class names, method names, variable names).
- **DO**: Use the same terms in scenarios, tests, documentation, and conversation.
- **DO**: Update code when the team's understanding of a term changes.
- **DO**: Define terms explicitly when they're ambiguous.
- **DON'T**: Use different names for the same concept in different layers.
- **DON'T**: Invent technical jargon when a domain term exists.
- **DON'T**: Let terms drift — re-articulate meaning when confusion arises.

## Patterns
### The Rule
```
What the business calls it = What the code calls it = What the test calls it
```

### Language in Code
```
// BAD: technical terms
class DataProcessor { processRecord(obj) {} }

// GOOD: domain terms
class LoanApplication { submitForApproval(applicant) {} }
```

| Business Says | Code Should Use | NOT |
|---------------|-----------------|-----|
| "Place an order" | `placeOrder()` | `createRecord()`, `submitData()` |
| "Customer" | `Customer` | `User`, `Client`, `Account` |
| "Shipping address" | `shippingAddress` | `address2`, `deliveryAddr` |
| "Cancel subscription" | `cancelSubscription()` | `deactivate()`, `setInactive()` |
| "Approval workflow" | `ApprovalWorkflow` | `StateManager`, `ProcessHandler` |

### Building the Language
1. **Listen** to how domain experts talk about the system.
2. **Write down** key terms and their definitions.
3. **Use those terms** in code, tests, and documentation.
4. **Challenge** when a term feels wrong: "Do you call this a 'User' or a 'Customer'?"
5. **Update** code when the team's understanding of a term evolves.

### Bounded Context Language
The same word may mean different things in different contexts; each bounded
context defines its own model. Don't force a single class to serve all contexts:
```
"Account" in Auth context     → login credentials, sessions
"Account" in Billing context  → payment methods, invoices
"Account" in CRM context      → company profile, contacts
```

## Warning Signs
- Multiple names for the same concept in the codebase.
- Technical jargon where a domain term exists.
- Developers and business people talking past each other.
- New team members confused by naming.
