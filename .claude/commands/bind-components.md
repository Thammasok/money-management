---
description: Stage 19 of 28 — wire services to components in container/page components. Invoked by the frontend track agent.
user-invocable: false
---
# /project:bind-components

## Stage
19 of 28 — Bind Components with Service

## Setup
**Role**: `roles/frontend-dev.md`
**Guidelines**:
- `guidelines/dependency-injection.md`
- `guidelines/reduce-coupling.md`
- `guidelines/test-first.md`
- `guidelines/simple-design.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:dependency-injection` — when wiring dependencies between components
- `/project:reduce-coupling` — when designing module boundaries
- `/project:test-first` — when writing tests before implementation
- `/project:simple-design` — when tempted to add speculative functionality
- `/project:adjacent-code-review` — when pre-existing code in the story scope has anti-patterns

## Input
Read:
- `artifacts/{feature}/07-development-plan.md` — current task
- Component files from Stage 18
- Service files from Stage 17
- Frontend interface definitions from Stage 16

## Task
Wire components to services and state management. This is where the dataflow becomes live.

### Binding Steps

1. **Connect components to presenters/services**:
   - Inject service dependencies into components
   - Wire user actions to service methods
   - Wire state changes to component re-renders
   ```
   // Example: Container component wires service to humble component
   component LoginPage:
     authService = inject(AuthService)       // DI
     state = createState({ isLoading, error, user })

     function handleSubmit(email, password):
       state.set("isLoading", true)
       try:
         user = await authService.login(email, password)
         state.set("user", user)
         navigateTo("/dashboard")
       catch error:
         state.set("error", error.message)
       finally:
         state.set("isLoading", false)

     render:
       LoginForm(
         onSubmit = handleSubmit,
         isLoading = state.isLoading,
         error = state.error
       )
   ```

2. **Wire navigation / routing**:
   - Connect page transitions to scenario flows
   - Ensure navigation follows the flow document

3. **Wire error handling**:
   - API errors → state → component error display
   - Validation errors → form field error display
   - Network errors → global error handling

4. **Test the bindings**:
   ```
   test suite "LoginPage (binding)":
     test "should call authService.login and update state on form submit":
       // Arrange
       mockAuthService = { login: mockFunction().returnsAsync(mockUser) }
       renderedPage = render(LoginPage, providers: { authService: mockAuthService })

       // Act
       fillField(renderedPage.getById("email"), "user@test.com")
       fillField(renderedPage.getById("password"), "pass123")
       click(renderedPage.getById("login-submit"))

       // Assert
       await waitUntil:
         assertCalledWith(mockAuthService.login, "user@test.com", "pass123")
   ```

### Binding Architecture
```
Page/Container (wiring layer)
  ├── injects: Service (from DI container)
  ├── manages: State (from state management)
  └── renders: Humble Component (passes props)
        ├── receives: data props (from state)
        ├── receives: callback props (from container)
        └── fires: user events (via callbacks)
```

### Optimistic State Updates
When a service call mutates server-side state, update local state from the API response rather than re-fetching:

```
// BAD: re-fetch returns same static data in mock mode
function handleArrive():
  await statusTransitionService.arriveTable(tableId)
  await loadFloorPlan()   // <-- returns stale data from mock

// GOOD: update local state from API response
function handleArrive():
  try:
    res = await statusTransitionService.arriveTable(tableId)
    updateTableInState(res.tableId, { status: res.status })
  catch:
    // error handling
```

**Why this matters**: Mountebank stubs are static — GET endpoints always return the same data regardless of previous mutations. Optimistic updates ensure the UI reflects state changes immediately, working correctly against both static mocks (Stage 21) and real backends (Stage 25).

**Pattern**: Create a helper to update nested state:
```
function updateTableInState(tableId, updates):
  floorPlans = state.get("floorPlans")
  for each floorPlan in floorPlans:
    for each table in floorPlan.tables:
      if table.id == tableId:
        merge table with updates
  state.set("floorPlans", floorPlans)
```

Apply this for ALL state-mutating handlers (create, update, delete, status transitions).

### Error Handling in Handlers
Wrap all async handlers in try/catch. On error, keep dialogs open (don't close) so the user sees the failure state. This also prevents unhandled promise rejections:

```
function handleCreateArea(data):
  try:
    newArea = await areaService.createArea(data)
    state.set("showDialog", false)
    state.append("floorPlans", { area: newArea, tables: [] })
  catch:
    // Dialog stays open -- user sees the error state
```

### Constraints
- Walking skeleton binding FIRST
- Container/page components handle wiring only — no business logic
- Humble components receive everything via props
- Test that wiring is correct (service called, state updated)
- Keep binding layer thin
- Use optimistic state updates — update local state from API responses, don't re-fetch after mutations

## Output
- Container/page component files wiring services to components
- Binding test files
- Update `artifacts/{feature}/07-development-plan.md` — mark this task done

## Done
Summarize:
- Pages wired to services
- Dataflow working end-to-end (without real API)
- All binding tests passing

After summary, **reviewer reviews**. Ask developer to double-check and open PR if approved.
