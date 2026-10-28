---
description: Stage 3 of 28 — write BDD Given/When/Then scenarios. Invoked by the pre-dev track agent.
user-invocable: false
---
# /project:write-scenarios

## Stage
3 of 28 — Write Scenarios

## Setup
**Role**: `roles/qa.md`
**Guidelines**:
- `guidelines/bdd-scenarios.md`
- `guidelines/walking-skeleton.md`
- `guidelines/test-boundary-only.md`
- `guidelines/ubiquitous-language.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:bdd-scenarios` — when writing Given/When/Then scenarios
- `/project:walking-skeleton` — when identifying or implementing the skeleton scenario
- `/project:ubiquitous-language` — when naming classes, methods, or variables
- `/project:test-boundary-only` — when deciding what to test in a class/function

## Input
Read:
- `artifacts/{feature}/01-requirements.md`
- `artifacts/{feature}/02-flow.md`

## Task
Convert requirements and flows into BDD scenarios using Given/When/Then format.

1. **Read** requirements and flow artifacts.
2. **Write scenarios** for every acceptance criterion:
   - Happy path scenarios
   - Edge case scenarios
   - Error case scenarios
3. **Mark** the 1 most important scenario for the walking skeleton.
4. **Use** ubiquitous language — no technical implementation details.
5. **Create** a coverage matrix mapping requirements → scenarios.

Use the template at `templates/scenarios.md`.

## Output
Write: `artifacts/{feature}/03-scenarios.md`

## Done
Summarize:
- Total scenarios written
- Walking skeleton scenario identified
- Coverage matrix summary

Ask: "Review `artifacts/{feature}/03-scenarios.md` — edit if needed, then type **continue** to proceed to Stage 4: Prepare Test Data."
