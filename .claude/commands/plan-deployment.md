---
description: Stage 26 of 28 — plan the deployment approach. Invoked by the deployment track agent.
user-invocable: false
---
# /project:plan-deployment

## Stage
26 of 28 — Plan Deployment

## Setup
**Role**: `roles/backend-dev.md` + `roles/reviewer.md`
**Guidelines**:
- `guidelines/feature-flag.md`
- `guidelines/company-architecture.md`
- `guidelines/simple-design.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:feature-flag` — when implementing brownfield changes
- `/project:company-architecture` — when understanding system dependencies
- `/project:simple-design` — when tempted to add speculative functionality

## Input
Read:
- `artifacts/{feature}/01-requirements.md` — scope of changes
- `artifacts/{feature}/08-implementation-notes.md` — what was built
- Company architecture: `.claude/company/architecture.md`
- Existing CI/CD configuration (if any)

## Task
Plan the deployment strategy for this feature.

### 1. Assess Deployment Risk
Evaluate based on:
- **Scope**: How many services/repos are affected?
- **Data**: Are there database migrations? Schema changes?
- **Dependencies**: Does this change affect upstream/downstream services?
- **Reversibility**: Can this be rolled back safely?
- **User Impact**: How many users are affected if something goes wrong?

### 2. Choose Deployment Strategy

#### Blue-Green Deployment
Best when: Zero-downtime required, full rollback capability needed.
```
Production (Blue) ──── Router ──── Staging (Green)
                         │
                    Switch on verification
```
- Deploy to Green environment
- Run smoke tests against Green
- Switch router from Blue to Green
- Keep Blue as instant rollback target
- Requires careful database migration strategy (both versions must work with same schema)

#### Canary Release
Best when: Gradual rollout, monitor before full release.
```
100% users ──▶ 5% to new version ──▶ monitor ──▶ 25% ──▶ 50% ──▶ 100%
```
- Deploy new version to small subset of infrastructure
- Route small percentage of traffic to new version
- Monitor error rates, latency, business metrics
- Gradually increase traffic if metrics are healthy
- Roll back immediately if metrics degrade

#### Feature Flag (Dark Launch)
Best when: Backend changes, decouple deploy from release.
```
Deploy with flag OFF ──▶ Enable for internal users ──▶ Enable for % ──▶ Enable for all
```
- Already using FeatBit — leverage existing feature flags
- Deploy code with flag disabled
- Enable for internal users / QA first
- Gradually roll out to user segments
- Kill switch available at any time

#### Direct Deploy (Simple)
Best when: Low risk, small change, strong test coverage.
```
Deploy ──▶ Smoke test ──▶ Monitor ──▶ Done
```
- Only for low-risk changes with comprehensive test coverage
- Must have monitoring in place
- Must have fast rollback capability

### 3. Plan Database Migration
If Liquibase changes are involved:
- **Expand-Contract pattern**: New columns/tables first, migrate data, then remove old
- Liquibase runs as a Docker service (`migrations` in docker-compose) — it executes and exits before the backend starts
- Production compose runs Liquibase without `--contexts` (schema only, no seed data)
- Dev/test compose runs Liquibase with `--contexts=test` (schema + seed data)
- Backend `depends_on` migrations with `service_completed_successfully`
- Ensure rollback is possible without data loss
- Test migration on staging with production-like data volume
- No manual `liquibase` CLI needed — everything is automated via Docker

### 4. Plan Rollback
For every deployment, define:
- How to detect failure (monitoring, alerts, health checks)
- How to roll back (revert deploy, disable feature flag, switch blue-green)
- Maximum time before rollback decision
- Data recovery plan if migration involved

### 5. Define Smoke Tests
Post-deployment verification:
- Critical API endpoint health checks
- Key user flows (walking skeleton scenario at minimum)
- Database connectivity and migration verification
- 3rd party service connectivity

Use the template at `templates/deployment-plan.md`.

## Output
Write: `artifacts/{feature}/11-deployment-plan.md`

## Done
Summarize:
- Deployment strategy chosen and why
- Migration plan
- Rollback plan
- Smoke test plan

Ask: "Review `artifacts/{feature}/11-deployment-plan.md` — edit if needed, then type **continue** to proceed to Stage 27: Create Deployment Config."
