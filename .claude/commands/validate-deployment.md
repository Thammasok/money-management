---
description: Stage 28 of 28 — validate deployment readiness and write the deployment report. Invoked by the deployment track agent.
user-invocable: false
---
# /project:validate-deployment

## Stage
28 of 28 — Validate Deployment

## Setup
**Role**: `roles/reviewer.md`
**Guidelines**: ALL guidelines loaded

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:validate-deployment-practices` — to verify deployment readiness

## Input
Read:
- `artifacts/{feature}/11-deployment-plan.md`
- CI/CD pipeline configuration
- Dockerfile / docker-compose files
- Smoke test scripts
- Feature flag configuration

## Task
Validate that the deployment configuration follows best practices and is production-ready.

### Validation Checklist

#### 1. Reproducible Build
- [ ] **Deterministic**: Same source code produces same build artifact
- [ ] **Locked dependencies**: Lock files committed (package-lock.json, etc.)
- [ ] **No external fetches at build time**: All dependencies resolved from lock file
- [ ] **Multi-stage Docker build**: Build and runtime stages separated
- [ ] **Pinned base images**: Docker images use specific tags, not `latest`

#### 2. Immutable Server
- [ ] **No runtime modifications**: Server is deployed from image, never patched in-place
- [ ] **Config externalized**: All configuration via environment variables
- [ ] **No snowflake state**: Server can be destroyed and recreated from image
- [ ] **Health checks defined**: Container and application-level health checks

#### 3. Deployment Strategy
- [ ] **Strategy matches risk**: High-risk → canary/blue-green, low-risk → direct
- [ ] **Rollback plan defined**: Clear steps to revert if deployment fails
- [ ] **Migration safe**: Database migrations are forward-compatible (expand-contract)
- [ ] **Feature flag configured**: FeatBit flag for brownfield changes, default OFF

#### 4. Pipeline Integrity
- [ ] **All stages present**: Build → Unit Test → Integration Test → Deploy Staging → Deploy Prod
- [ ] **Tests run before deploy**: No deployment without passing all test suites
- [ ] **Manual approval gate**: Human approval before production deployment
- [ ] **Smoke tests post-deploy**: Automated verification after deployment
- [ ] **Artifact promotion**: Same artifact promotes through stages (not rebuilt)

#### 5. Monitoring & Alerting
- [ ] **Error rate monitoring**: Alert on error rate spike post-deployment
- [ ] **Latency monitoring**: Alert on latency degradation
- [ ] **Business metrics**: Critical success indicators monitored
- [ ] **Rollback trigger**: Automated or defined threshold for rollback decision
- [ ] **Log aggregation**: Structured logs searchable for debugging

#### 6. Security
- [ ] **No secrets in code**: All secrets via environment variables or secret management
- [ ] **No secrets in Docker image**: Build args and runtime env separated
- [ ] **Minimal container**: Alpine base, non-root user, minimal packages
- [ ] **Dependency scanning**: Known vulnerability check in pipeline

### Scoring
For each category: PASS / NEEDS_IMPROVEMENT / FAIL

## Output
Write: `artifacts/{feature}/12-deployment-validation-report.md`

## Done
Summarize:
- Score per category
- Issues found
- Overall deployment readiness: READY / NOT READY

If READY:
"All 28 stages complete. Feature `{feature}` is fully developed, tested, validated, and deployment-ready."

If NOT READY:
List specific items to fix before deployment.
