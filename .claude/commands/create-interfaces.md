---
description: Stage 11 of 28 — define backend interfaces (entities, DTOs, contracts) before implementation. Invoked by the backend track agent.
user-invocable: false
---
# /project:create-interfaces

## Stage
11 of 28 — Create Interfaces (Backend)

## Setup
**Role**: `roles/backend-dev.md`
**Guidelines**:
- `guidelines/interface-first.md`
- `guidelines/ubiquitous-language.md`
- `guidelines/dependency-injection.md`
- `guidelines/reduce-coupling.md`
- `guidelines/simple-design.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:interface-first` — when defining contracts before implementation
- `/project:ubiquitous-language` — when naming classes, methods, or variables
- `/project:dependency-injection` — when wiring dependencies between components
- `/project:reduce-coupling` — when designing module boundaries
- `/project:simple-design` — when tempted to add speculative functionality

## Input
Read:
- `artifacts/{feature}/07-development-plan.md` — current task
- `artifacts/{feature}/01-requirements.md` — entities and domain concepts
- `artifacts/{feature}/02-flow.md` — API contracts
- `artifacts/{feature}/03-scenarios.md` — behavior contracts
- `artifacts/{feature}/06-api-test-plan.md` — request/response shapes
- `epic.md` (project root) — Shared Domain Entities: for any entity this feature touches that's shared across features, use its **exact** canonical name and field definitions from that table. Redefining a shared concept differently here is exactly the drift `epic-conformance` audits for later — get it right at the source instead.
- `docs/ERD.md` (project root, if it exists) — the planned relationships this feature's entities participate in (see Constraints)

## Task
Define all interfaces BEFORE writing any implementation. This is the contract that drives everything.

1. **Define Entity interfaces** — domain objects:
   ```
   // Example: entity shape
   Entity User
     id: String
     email: String
     name: String
     createdAt: DateTime
     updatedAt: DateTime
   ```

2. **Define DTO interfaces** — data transfer between layers:
   ```
   // Request DTOs (what the entry point receives)
   DTO CreateUserRequest
     email: String
     name: String
     password: String

   // Response DTOs (what the entry point returns)
   DTO CreateUserResponse
     id: String
     email: String
     name: String

   // Internal DTOs (between layers)
   DTO UserServiceInput
     email: String
     name: String
     hashedPassword: String
   ```

3. **Define Business Logic interfaces** — orchestration and domain rule contracts:
   ```
   Interface UserService
     createUser(input: CreateUserRequest) -> CreateUserResponse
     getUserById(id: String) -> UserResponse
     // Only methods needed for current scenarios
   ```

4. **Define Data Access interfaces** — storage contracts:
   ```
   Interface UserRepository
     save(user: User) -> User
     findById(id: String) -> User or null
     // Only methods needed for current scenarios
   ```

5. **Define External Integration interfaces** — 3rd-party service contracts:
   ```
   Interface EmailGateway
     sendWelcomeEmail(to: String, name: String) -> void
   ```

6. **Define Real-Time interfaces** (if needed) — bi-directional communication:
   ```
   Interface FloorGateway
     broadcast(event: String, data: Any) -> void
   ```

7. **Define Validation interfaces** (if needed):
   ```
   Interface UserValidator
     validateCreateRequest(input: CreateUserRequest) -> ValidationResult
   ```

### Architecture Layer Map
Consult `.claude/tech-stack-profile.md` → Architecture Pattern for the concrete layer names in this project. The generic roles below adapt to any architecture:

```
Entry Point (e.g. Controller, Resolver, EventHandler) ──uses──▶ Business Logic Interface
                                                                       │
                                                                 ──uses──▶ Data Access Interface
                                                                 ──uses──▶ External Integration Interface
                                                                 ──uses──▶ Real-Time Interface (if needed)
                                                                 ──uses──▶ Validation Interface
```

### Constraints
- Use ubiquitous language for all names
- Only define what current scenarios need (no speculative methods)
- Interfaces should describe WHAT, not HOW
- DTOs should not leak internal domain structure
- One interface per boundary (controller↔service, service↔repository, service↔gateway)
- Consider bounded context — don't share entities across different domain areas
- **Must not contradict `docs/ERD.md`** — if the diagram shows a relationship for one of this feature's entities (a required reference, a specific cardinality), the Entity/DTO interfaces here must reflect it, not a different shape. This is a violation check, not a redundancy audit: if `docs/ERD.md` doesn't exist yet, or doesn't cover an entity, proceed normally

## Output
- Interface/type definition files organized by layer
- Update `artifacts/{feature}/07-development-plan.md` — mark this task done

## Done
Summarize:
- Entities defined
- DTOs defined (request, response, internal)
- Business Logic interfaces defined
- Data Access interfaces defined
- External Integration interfaces defined (if any)
- Real-Time interfaces defined (if any)
- Validation interfaces defined (if any)

After summary, **reviewer reviews** this task. Ask developer to double-check and open PR if approved.
