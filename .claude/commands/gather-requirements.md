---
description: Stage 1 of 28 — generate and validate functional requirements for a feature. Invoked by the pre-dev track agent.
user-invocable: false
---
# /project:gather-requirements

## Stage
1 of 28 — Generate & Validate Requirements

## Setup
**Role**: `roles/product-owner.md`
**Guidelines**:
- `guidelines/walking-skeleton.md`
- `guidelines/ubiquitous-language.md`
- `guidelines/company-architecture.md`
- `guidelines/simple-design.md`

## Consideration Skills
- `/project:walking-skeleton` — when identifying the skeleton scenario
- `/project:ubiquitous-language` — when naming actors, actions, or domain concepts
- `/project:domain-modeling` — when a term is fuzzy or two words are in play for one concept
- `/project:deep-modules` — when relaying the epic's module and seam decisions into the Architecture Slice
- `/project:simple-design` — when tempted to add speculative functionality
- `/project:company-architecture` — when understanding system dependencies

## Input
Read ALL of the following:
- `epic.md` — feature description, shared entities, **Domain Language**, **Service Architecture**, conventions, and any `AD-n` Architecture Decisions that bind this feature
- `.claude/tech-stack-profile.md` — concrete layer names, frameworks, patterns
- `.claude/company/architecture.md` — system context and constraints (if exists)
- `artifacts/{feature}/01-requirements.md` — if it already exists, refine it instead of starting from scratch

The user's problem statement for this feature comes from the `epic.md` feature description. If the user passed additional notes directly, use those too.

## Task
You are a Product Owner and Business Analyst in one pass. Your job is to produce a complete, validated `01-requirements.md` from whatever input exists — whether that is a raw problem statement, rough notes, or a partially written file.

Do NOT ask the user to write anything before you start. Generate first, validate in the same pass.

### Step 1 — Understand the Feature
From `epic.md` and any user notes, extract:
- The actor(s) affected
- The core user goal
- The business value
- How it fits into the epic build order (what it depends on, what depends on it)
- Which shared entities from the epic are involved
- Which **modules and seams** from the epic's Service Architecture this feature touches, and each one's dependency category — the backend and frontend track agents never read `epic.md`, so `01-requirements.md` is the only way these decisions reach them
- The **banned words** from the Domain Language `_Avoid_` lists that this feature could plausibly reach for

### Step 2 — Generate Requirements

#### 2a — User Stories
Write INVEST-compliant user stories:

```
As a {specific actor}
I want {concrete action}
So that {measurable business benefit}
```

Rules:
- Use domain language — no technical terms
- One story = one user goal; split if two distinct needs
- The "so that" must state business value, not describe the feature
- Mark the walking skeleton story (the one touching the most layers with the highest user value)

#### 2b — Acceptance Criteria
For each story, write 3–6 Given/When/Then criteria:
- At least 1 happy path
- At least 1 error/failure case
- At least 1 edge case
- Every criterion must be testable (yes/no pass/fail)

#### 2c — API Endpoints
For every server interaction, define:

```
Method + Path: POST /api/feature/action
Auth: public | protected
Input:  { field: type, field: type }
Output: { field: type, field: type }
Errors: 400 {reason}, 401, 404 {reason}
```

#### 2d — UI Components
List every interactive element with a stable ID:

```
| Component ID       | Type     | Behavior                          |
|--------------------|----------|-----------------------------------|
| quota-badge        | display  | shows X / Y calls remaining       |
| upgrade-cta-button | button   | opens upgrade modal on click      |
```

#### 2e — Walking Skeleton Scenario
Identify the single scenario that:
- Touches the most system layers (frontend → backend → database)
- Has the highest user value
- Exposes the most integration risk

State it explicitly — this is implemented FIRST in every track.

#### 2f — Out of Scope
List what is explicitly NOT included to prevent scope creep.

### Step 3 — Self-Validate (replaces gather-requirements review)
After generating, validate completeness. Fix any gaps before writing the file:

- [ ] Every story has a "so that" with real business value
- [ ] Every story has ≥3 acceptance criteria (happy + error + edge)
- [ ] Every API endpoint has typed input AND typed output
- [ ] Every UI interactive element has a component ID
- [ ] Walking skeleton scenario is identified
- [ ] Shared entities from `epic.md` are used with identical names/fields
- [ ] No speculative requirements — everything is needed NOW
- [ ] Ubiquitous language used consistently throughout
- [ ] Architecture Slice names every module this feature touches, each with its dependency category
- [ ] No banned word from a Domain Language `_Avoid_` list is *used* as an entity, endpoint, component, or field name (the Banned words line itself is the one place they may appear)

If any check fails, fix it in the same pass — do not produce an incomplete file.

### Step 4 — Tech Stack Check
If `.claude/tech-stack-profile.md` does NOT exist, stop and ask the user:
1. Frontend framework (React, Vue, Next.js, etc.) + build tool
2. Backend framework (Express, FastAPI, Spring Boot, etc.) + language
3. Database
4. Other tools (ORM, CSS framework, state management)

Save answers to `.claude/tech-stack-profile.md` then continue.

If the file already exists, read it and continue — do not ask again.

## Output
Write: `artifacts/{feature}/01-requirements.md`

```markdown
# Requirements: {feature}

## Feature Context
- **Epic**: {epic name}
- **Depends on**: F-{n} (or none)
- **Blocks**: F-{n} (or none)
- **Shared Entities Used**: {entity names from epic.md}

## Architecture Slice

> This feature's rows from `epic.md` → Service Architecture. The backend and frontend track agents do
> not read `epic.md` — this section is how the plan's module and seam decisions reach them.

| Module | Interface — what a caller must know | Seam & adapters | Dependency category |
|---|---|---|---|
| {ModuleName} | {entry points + invariants, ordering, error modes} | {production adapter / test adapter} | {In-process \| Local-substitutable \| Remote but owned \| True external} |

- **Acceptance seam**: {the seam the E2E suite drives}
- **Banned words**: {word}, {word} — from the Domain Language `_Avoid_` lists; never use these as type, function, or field names.
- **Binding decisions**: {AD-n and what it constrains, or "none"}

## Actors
| Actor | Description | Goal |
|---|---|---|
| {actor} | {who} | {what they achieve} |

## User Stories

### US-1: {title} 🦴 Walking Skeleton
**As a** {actor}
**I want** {action}
**So that** {benefit}

**Acceptance Criteria:**
- [ ] Given ..., When ..., Then ... (happy path)
- [ ] Given ..., When ..., Then ... (error case)
- [ ] Given ..., When ..., Then ... (edge case)

---

### US-2: {title}
...

## API Endpoints
| Method | Path | Auth | Input | Output | Errors |
|---|---|---|---|---|---|
| POST | /api/... | protected | { field: type } | { field: type } | 400, 401 |

## UI Components
| Component ID | Type | Behavior |
|---|---|---|
| {id} | {type} | {what it does} |

## Walking Skeleton Scenario
{one paragraph — the single scenario implemented first, touching all layers}

## Out of Scope
- {item}: {why excluded}

## Open Questions
- {question needing PO/stakeholder decision, if any}
```

## Done
Summarize:
- Stories written and walking skeleton identified
- API endpoints defined
- UI components catalogued
- Validation checks passed
- Any open questions that need answers before Stage 2

Ask: "Review `artifacts/{feature}/01-requirements.md` — edit if needed, then type **continue** to proceed to Stage 2: Design Flow."
