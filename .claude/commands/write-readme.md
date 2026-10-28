---
description: Stage 27.5 of 28 — write or refresh the project README to match the current codebase. Invoked by the deployment track agent.
user-invocable: false
---
# /project:write-readme

## Type
Maintenance skill — invoked after deployment config is created or whenever project setup changes.

## Purpose
This skill owns TWO files with OPPOSITE regeneration policies — do not confuse them:

- **`README.md`** — the CURRENT state of the codebase, nothing else. Each run **fully regenerates every section from code**; never preserve, merge, or build on top of the existing prose. If a README already exists, read it only for section order / tone consistency; its content is not a source of truth and must not be carried forward, especially any historical or reconciliation commentary (see Constraints).
- **`docs/BUILD-LOG.md`** — the durable, per-feature build history. The opposite policy: **append one new entry per feature run; never regenerate or rewrite prior entries.** This is the file that historical/reconciliation detail belongs in (see "Build Log" below) — it exists precisely so that detail has a real home instead of accumulating in `README.md`.

Getting these two swapped — appending history into `README.md`, or blowing away `docs/BUILD-LOG.md`'s past entries — is the single most important mistake to avoid in this skill.

## When to Invoke
- After Stage 27 (Create Deployment Config) — to document the final setup
- After any change to Docker compose files, tech stack, test infrastructure, or project structure
- When the user explicitly requests a README update

## Input
Read the following to derive README content (do NOT ask the user — derive everything from code):
- `package.json` (backend and frontend) — dependencies, scripts
- `docker-compose.yml` — production stack
- `docker-compose-dev.yml` — development stack
- `docker-compose.backing-service.yml` — test backing services
- `db/changelog/db.changelog-master.yaml` — migration structure
- `db/seed-reset.sql` — seed data reference
- Backend source structure (`backend/src/`)
- Frontend source structure (`frontend/src/`)
- Test files — count tests per type (Jest, Vitest, Bruno, Playwright)
- `.github/workflows/` — CI/CD pipeline
- `artifacts/` — feature artifacts
- `.claude/` — XP pipeline skills
- `docs/BUILD-LOG.md` (if it exists) — read it to find this feature's entry, if a prior run already appended one (re-run case — update that entry in place rather than duplicating it), and to see the current entry format so a new entry matches it

## README Structure

Write the README with these sections in order:

### 1. Title and Summary
- Project name as H1
- One-paragraph description of what the system does and who it's for

### 2. Tech Stack
- Table: Layer | Technology
- Include: backend, frontend, database, migrations, auth, feature flags, CI/CD
- Sub-table: Testing — Type | Tool | Count. Count is a SINGLE current number (e.g. "754 tests, 58 files") measured this run — no per-feature deltas, no explanation of how the count changed since a prior README, no PR/commit references

### 3. Features
- Bulleted list of key features with short descriptions
- Derive from implemented endpoints, UI pages, and domain logic

### 4. Project Structure
- Tree diagram of top-level directories with one-line descriptions
- Include: backend/, frontend/, db/, collection/, mocks/, scripts/, artifacts/, .claude/

### 5. Prerequisites
- Runtime requirements (Node.js, Docker, etc.)
- Do NOT list Liquibase as a prerequisite — it runs inside Docker

### 6. Getting Started

#### Development (docker-compose-dev.yml)
```bash
docker compose -f docker-compose-dev.yml up
```
- Describe what starts: DB + Liquibase migrations + seed data + Mountebank + backend + frontend (Vite HMR)
- List URLs: frontend, backend, Mountebank admin
- List seed credentials (username, password, role)

#### Production (docker-compose.yml)
```bash
docker compose up --build
```
- Describe what starts: DB + Liquibase migrations (schema only, no seed) + backend + frontend (nginx)
- List URLs and health check endpoints

#### Manual / Without Docker
- How to start backing services, run migrations manually, start backend, start frontend
- For advanced users who want to run services outside Docker

### 7. Running Tests
- Backend unit tests command
- Frontend unit tests command
- Bruno API contract tests command
- Playwright E2E tests command
- Note about parallel E2E with per-worker DB isolation
- State counts as current facts only — no reconciliation math, no historical deltas, no PR/commit citations. That belongs in `docs/BUILD-LOG.md` (append it there per feature — see "Build Log" below), not here; link to it, never inline it

### 8. Seed Credentials
- Table: Role | Username | Password

### 9. Architecture
- Backend layers diagram and description
- Frontend layers diagram and description
- Table state machine diagram
- Feature flags explanation

### 10. CI/CD Pipeline
- Pipeline stages and what each does, as they exist NOW
- Per-feature job additions, `continue-on-error` exceptions, and Contract Disputes do NOT belong here — append them to `docs/BUILD-LOG.md` instead (see "Build Log" below) and link to it

### 11. Development Framework
- Brief mention of XP pipeline in `.claude/`
- Link to `develop.md` for details

## Build Log — `docs/BUILD-LOG.md` (append-only, separate from README.md above)

This is where all the historical/reconciliation detail the README Constraints forbid actually goes — it exists so that detail has a real home instead of accumulating in `README.md`.

1. **Read `docs/BUILD-LOG.md`** if it exists. If it already has an entry for the feature currently at Stage 27.5, update that entry in place (re-run case) — do not duplicate it. Otherwise, this is a new entry.
2. **Append one entry** under a `## Feature History` section (create the section if missing), most-recent-last, as `### F-{n}: {feature-name}`:
   - Test-count delta and the math behind it (this feature's tests added/removed, reconciled against the prior total)
   - Schema/migration changes (tables/columns added, migration numbers, any renumbering)
   - CI/CD job changes for this feature (new jobs, `continue-on-error` exceptions and why, Contract Disputes and their resolution or why they remain open)
   - Relevant PR/commit references — this is the ONE file in the project where those belong
3. **Never touch a prior entry's content** beyond what step 1 allows (updating THIS feature's own entry on a re-run). Every other existing entry — including the pre-existing history up to F-38 already in the file — is permanent and must be preserved byte-for-byte.
4. If `docs/BUILD-LOG.md` doesn't exist yet, create it with a `# {Project Name} — Build Log` header and the `## Feature History` section containing just this feature's entry.

## Constraints
- Derive ALL content from code — never invent or assume
- Keep it concise — README should be scannable, not a novel
- **NEVER include reconciliation/forensic prose**: no historical test-count deltas, no PR numbers, no commit hashes, no explanations of why a fact changed since a prior version of this file, no per-feature "Contract Dispute" narratives. State only what is true RIGHT NOW, as directly measured/derived from code this run
- Historical/provenance detail (why a number changed, which commit fixed what, feature-by-feature reconciliation) belongs in `docs/BUILD-LOG.md` (append an entry — see "Build Log" above), not here. `artifacts/{feature}/{n}-deployment-report.md` is the per-feature source material that entry is drawn from. Link to `docs/BUILD-LOG.md` if genuinely useful; never inline its content into `README.md`
- Full regenerate, not incremental patch: rewrite each section fresh from the Input sources every run. The existing README's prose is not carried forward — only its presence informs section order/tone
- Use tables for structured data (tech stack, credentials, test counts)
- Use code blocks for commands
- Do NOT include emojis unless the user's existing README uses them
- Do NOT add badges unless the project already has CI configured
- Liquibase runs inside Docker — it is NOT a local prerequisite
- Seed data is controlled by Liquibase `--contexts=test` — explain this clearly
- `seed-reset.sql` is a test utility for E2E per-test resets — mention it separately from Liquibase seeds

## Output
- Updated `README.md` at project root (full regenerate)
- Updated `docs/BUILD-LOG.md` (append this feature's entry, or update it in place on a re-run — all prior entries untouched)

## Done
Summarize what sections were written or updated in `README.md`, and confirm the `docs/BUILD-LOG.md` entry appended (or updated) for this feature.
