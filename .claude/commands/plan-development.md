---
description: Stage 8 of 28 — produce the development plan and task breakdown. Invoked by the pre-dev track agent.
user-invocable: false
---
# /project:plan-development

## Stage
8 of 28 — Plan Development

## Setup
**Role**: `roles/product-owner.md` + `roles/reviewer.md`
**Guidelines**:
- `guidelines/walking-skeleton.md`
- `guidelines/simple-design.md`
- `guidelines/interface-first.md`
- `guidelines/feature-flag.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:walking-skeleton` — when identifying or implementing the skeleton scenario
- `/project:simple-design` — when tempted to add speculative functionality
- `/project:interface-first` — when defining contracts before implementation
- `/project:feature-flag` — when implementing brownfield changes

## Input
Read:
- `artifacts/{feature}/01-requirements.md`
- `artifacts/{feature}/02-flow.md`
- `artifacts/{feature}/03-scenarios.md` (includes the Test Data section)
- `artifacts/{feature}/05-ui-test-plan.md`
- `artifacts/{feature}/06-api-test-plan.md`

## Task
Create a detailed development plan that breaks work into small tasks. Each task will be reviewed before the developer opens a PR.

1. **Determine track**: Ask the user which track to develop:
   - **Backend only**
   - **Frontend only**
   - **Both** (backend first, then frontend)

2. **Identify the walking skeleton tasks first** — these run before anything else.

3. **For the chosen track(s), break into tasks** following the pipeline order:

### Backend Tasks (if chosen)
Consult `.claude/tech-stack-profile.md` → Architecture Pattern for the concrete layer names to use in B4 sub-tasks.

```
B1. Create Liquibase seed data/migration scripts
B2. Create/update docker-compose.backing-service.yml
B3. Define interfaces (entity, DTO, model, contracts for each layer role)
B4. Implement walking skeleton scenario (test first → code):
    B4a. Entry Point layer (test → code)
    B4b. Business Logic layer (test → code)
    B4c. Data Access layer (test → code)
    B4d. Validation layer (test → code)
    B4e. External Integration layer (test → code, if needed)
    B4f. Real-Time layer (test → code, if needed)
    B4g. Utility functions (test → code, if needed)
B5. Implement remaining scenarios (test first → code each)
B6. Run all API integration tests (real service + mock 3rd party + real DB)
B7. Practice validation + refactoring
```

### Frontend Tasks (if chosen)
```
F1. Define frontend interfaces (API contracts, state models, component props)
F2. Create plain UI page (structure only)
F3. Create service — dataflow first (test without UI)
F4. Create plain components + state (component test → code)
F5. Bind components with service
F6. Wire pre-authored E2E specs (`e2e/{feature}/` from Stage 7.5) to the implemented UI — no authoring
F7. Run Playwright + mock API server
F8. Beautify UI (apply design tokens)
F9. Re-run Playwright + mock API server
F10. Practice validation + refactoring
F11. Run all Playwright + real API + mock 3rd party + real DB
```

4. **For each task, define**:
   - What to implement
   - Which scenarios it covers
   - What tests to write
   - Dependencies on other tasks
   - Acceptance criteria for reviewer

5. **Apply constraints**:
   - Walking skeleton scenario FIRST (horizontal)
   - Then remaining scenarios (vertical)
   - Feature flag required for brownfield changes
   - Interface definitions before implementation
   - Test before code for every function

6. **Review cycle**: After each task:
   - Reviewer validates against guidelines
   - Developer double-checks
   - Developer opens PR

Use the template at `templates/development-plan.md`.

## Output
Write: `artifacts/{feature}/07-development-plan.md`

## Done
Summarize:
- Track chosen (backend / frontend / both)
- Number of tasks in the plan
- Walking skeleton tasks identified
- Estimated task order

Ask: "Review `artifacts/{feature}/07-development-plan.md` — edit if needed, then type **continue** to start development."
