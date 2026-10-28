---
description: Stage 2 of 28 — design screen/API flow with the component IDs that become the E2E contract. Invoked by the pre-dev track agent.
user-invocable: false
---
# /project:design-flow

## Stage
2 of 28 — Design Flow

## Setup
**Role**: `roles/product-owner.md`
**Guidelines**:
- `guidelines/walking-skeleton.md`
- `guidelines/ubiquitous-language.md`
- `guidelines/company-architecture.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:walking-skeleton` — when identifying or implementing the skeleton scenario
- `/project:ubiquitous-language` — when naming classes, methods, or variables
- `/project:company-architecture` — when understanding system dependencies

## Input
Read:
- `artifacts/{feature}/01-requirements.md`
- `docs/sequence.md` (project root, if it exists) — the epic-level flow this feature participates in, drawn across modules and seams by `plan-epic`

## Task
Design the user flow from the requirements, incorporating service design blueprint perspective.

1. **Read** the requirements artifact.
2. **Map the flow** step by step:
   - Customer actions (what the user does)
   - Frontstage actions (what the system shows)
   - Backstage actions (what happens behind the scenes)
   - Supporting processes (infrastructure, 3rd party calls)
3. **Define all UI component IDs** — break pages/sections from requirements into every interactive component (inputs, buttons, dialogs, lists, indicators, etc.) with unique IDs for Playwright targeting.
4. **Define API endpoints** needed for each flow step.
5. **Mark** the walking skeleton path through the flow.

Use the template at `templates/flow.md`.

**Must not contradict `docs/sequence.md`.** That diagram is epic-level — modules, seams and the messages between them; this artifact is feature-level — the user's steps, component IDs and endpoints. Where it shows this feature's flow (which module answers a call, what order the backstage steps run in), the flow here refines it rather than re-deciding it. This is a violation check, not a redundancy audit: if `docs/sequence.md` doesn't exist or doesn't cover this feature, proceed normally. A genuine disagreement — the requirements imply an order the diagram contradicts — is a **Contract Dispute** for `track-handoffs.md`, not a silent divergence.

## Output
Write: `artifacts/{feature}/02-flow.md`

## Done
Summarize:
- Number of flow steps
- UI components identified
- API endpoints identified
- Walking skeleton path marked

Ask: "Review `artifacts/{feature}/02-flow.md` — edit if needed, then type **continue** to proceed to Stage 3: Write Scenarios."
