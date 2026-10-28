# Walking Skeleton

## Purpose
Ensure the team builds a tiny end-to-end implementation linking all major architectural components before expanding functionality. This validates the architecture, team process, and technology choices early.

## Principles
- A walking skeleton is NOT a spike — it is permanent, production-quality code with tests.
- Build the 1 most important scenario first (horizontal slice).
- Make everything functional without taking UI into account.
- Implement every integration before development.
- After the skeleton works, implement other scenarios vertically.

## Rules
- **DO**: Pick the single most important scenario from the scenario list for the skeleton.
- **DO**: Implement end-to-end: from UI action → API → service → database → response.
- **DO**: Include real integration points (docker-compose backing services, mock 3rd party).
- **DO**: Write tests for the skeleton — it must be self-testing code.
- **DON'T**: Build multiple scenarios before the skeleton is complete.
- **DON'T**: Skip integration setup — the skeleton must prove the architecture works.
- **DON'T**: Treat the skeleton as throwaway code.

## Patterns

### Step 1: Identify the Skeleton Scenario
Look at `artifacts/{feature}/03-scenarios.md` and pick the one scenario that:
- Touches the MOST architectural layers end-to-end, and
- Delivers the MOST user value in isolation, and
- Exposes integration risks earliest.

### Step 2: Trace It Through Every Layer
Map the scenario through the architecture (use the concrete layer names from
`.claude/tech-stack-profile.md`):
```
User Action
  → UI Component (plain — no styling)
    → Frontend Service
      → API Request
        → Entry Point
          → Business Logic
            → Data Access (real backing service)
            → External Integration (mock 3rd party)
          → Response DTO
        → API Response
      → State Update
    → UI Update
```

### Step 3: Implementation Order
1. Set up backing services first (docker-compose) — prove infrastructure works.
2. Define interfaces at every boundary.
3. Implement backend end-to-end for the skeleton scenario (test first → code).
4. Run the API integration test — prove the backend works.
5. Implement frontend end-to-end for the skeleton scenario (test first → code).
6. Run the Playwright E2E test — prove the full stack works.
7. NOW you have a walking skeleton. Build remaining scenarios vertically.

Horizontal first (one scenario, all layers), then vertical (more scenarios, same layers).

## Common Mistakes
- Building all of one layer before moving to the next (waterfall within agile).
- Skipping integration setup — the skeleton must prove the architecture.
- Making the skeleton too large — it should be the MINIMUM end-to-end path.
- Treating it as a prototype to throw away — the skeleton is permanent, tested code.
