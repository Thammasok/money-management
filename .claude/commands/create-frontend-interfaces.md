---
description: Stage 16 of 28 — define frontend interfaces (API contracts, state models, component props). Invoked by the frontend track agent.
user-invocable: false
---
# /project:create-frontend-interfaces

## Stage
16 of 28 — Create Frontend Interfaces

## Setup
**Role**: `roles/frontend-dev.md`
**Guidelines**:
- `guidelines/interface-first.md`
- `guidelines/ubiquitous-language.md`
- `guidelines/reduce-coupling.md`
- `guidelines/simple-design.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:interface-first` — when defining contracts before implementation
- `/project:ubiquitous-language` — when naming classes, methods, or variables
- `/project:reduce-coupling` — when designing module boundaries
- `/project:simple-design` — when tempted to add speculative functionality

## Input
Read:
- `artifacts/{feature}/02-flow.md` — UI components and their data needs
- `artifacts/{feature}/03-scenarios.md` — behavior contracts
- `artifacts/{feature}/06-api-test-plan.md` — API request/response shapes
- Backend interface definitions (if backend track was done first)

## Task
Define all frontend interfaces BEFORE writing any implementation code.

1. **API Contract Types** — match the backend API exactly:
   ```
   // Request types (what frontend sends)
   CreateUserRequest:
     email: text
     name: text
     password: text

   // Response types (what frontend receives)
   CreateUserResponse:
     id: text
     email: text
     name: text

   // Error response types
   ApiError:
     status: integer
     message: text
     details: optional map of (text -> list of text)
   ```

2. **State Model** — application state shape:
   ```
   AuthState:
     user: UserProfile or null
     isAuthenticated: boolean
     isLoading: boolean
     error: text or null

   UserProfile:
     id: text
     email: text
     name: text
   ```

3. **Service Interfaces** — data access and business logic:
   ```
   AuthService:
     login(email: text, password: text) -> async LoginResponse
     logout() -> async void
     getCurrentUser() -> async UserProfile
   ```

4. **Component Props** — input/output contracts:
   ```
   LoginFormProps:
     onSubmit: callback(email: text, password: text) -> void
     isLoading: boolean
     error: text or null

   UserProfileCardProps:
     user: UserProfile
     onEdit: callback() -> void
   ```

5. **Event Types** — component communication:
   ```
   FormSubmitEvent:
     type: "FORM_SUBMIT"
     payload:
       email: text
       password: text

   NavigationEvent:
     type: "NAVIGATE"
     payload:
       path: text
   ```

### Constraints
- Match backend API contracts exactly (use same DTO names where possible)
- Use ubiquitous language for all type names
- Only interfaces needed for current scenarios
- Component props should make the component's contract clear
- State model should be minimal — only what the UI needs

## Output
- Frontend type/interface definition files
- Update `artifacts/{feature}/07-development-plan.md` — mark this task done

## Done
Summarize:
- API contract types defined
- State model defined
- Service interfaces defined
- Component props defined

After summary, **reviewer reviews**. Ask developer to double-check and open PR if approved.
