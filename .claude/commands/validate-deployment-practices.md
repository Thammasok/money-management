---
description: Validator — verify deployment config best practices: reproducible builds, CI/CD, monitoring, security.
user-invocable: false
---
# /project:validate-deployment-practices

## Type
Validator Skill — run after development to verify deployment readiness.

## Purpose
Validate that deployment configuration follows best practices: reproducible builds, immutable servers, proper CI/CD pipeline, monitoring, and security.

## Instructions

Read ALL deployment-related files (Dockerfile, docker-compose, CI/CD config, smoke tests, feature flag config). Check every item below.

### 1. Reproducible Build
- [ ] Same source code produces same build artifact (deterministic)
- [ ] Dependencies locked (lock files committed: package-lock.json, yarn.lock, etc.)
- [ ] No external fetches at build time beyond locked dependencies
- [ ] Docker images use multi-stage builds (build and runtime separated)
- [ ] Base images pinned to specific tags (not `latest`)
- [ ] Build can be reproduced from any commit in git history

### 2. Immutable Server
- [ ] Deployment is from a tested image — no runtime patching
- [ ] All configuration externalized via environment variables
- [ ] Server can be destroyed and recreated from image without loss
- [ ] No configuration drift possible — image is the source of truth
- [ ] Health checks defined at container and application level

### 3. CI/CD Pipeline
- [ ] Pipeline stages: Build → Test → Deploy Staging → Deploy Production
- [ ] All test suites run before any deployment
- [ ] Same artifact promotes through stages (not rebuilt per stage)
- [ ] Manual approval gate before production deployment
- [ ] Smoke tests run automatically post-deployment
- [ ] Pipeline fails fast (unit tests first, E2E last)

### 4. Deployment Strategy
- [ ] Strategy matches risk level of the change
- [ ] Rollback plan is defined and tested
- [ ] Database migrations are forward-compatible (expand-contract)
- [ ] Feature flag configured with default OFF for brownfield
- [ ] Rollout plan defined (percentage-based or user-segment based)

### 4.5. Database Migration Infrastructure
- [ ] Liquibase runs as a Docker service (`migrations` in compose), not as a manual CLI step
- [ ] Production compose runs Liquibase without `--contexts` (schema only, no seed data)
- [ ] Dev/test compose runs Liquibase with `--contexts=test` (schema + seed data)
- [ ] Backend `depends_on` migrations with `service_completed_successfully`
- [ ] No `db/init.sql` or manual SQL for schema — Liquibase is the single source of truth
- [ ] Three compose files exist: `docker-compose.yml` (prod), `docker-compose-dev.yml` (dev), `docker-compose.backing-service.yml` (test)
- [ ] Seed changesets use `context: test` so they never run in production
- [ ] `seed-reset.sql` (if used) is a test utility only — not part of the migration chain

### 5. Monitoring & Alerting
- [ ] Error rate monitoring configured with alert threshold
- [ ] Latency monitoring configured (p50, p95, p99)
- [ ] Business metrics identified and monitored (critical success indicators)
- [ ] Rollback trigger defined (automated threshold or manual decision point)
- [ ] Log aggregation in place with structured logging
- [ ] Dashboard accessible to the team

### 6. Security
- [ ] No secrets in source code or Docker image
- [ ] Secrets managed via environment variables or secret management service
- [ ] Container runs as non-root user
- [ ] Minimal base image (Alpine or distroless)
- [ ] Dependency vulnerability scanning in pipeline
- [ ] No unnecessary ports exposed

## Output Format
```markdown
# Deployment Validation Report

## Summary
| Category | Status | Issues |
|----------|--------|--------|
| Reproducible Build | PASS/FAIL | N issues |
| Immutable Server | PASS/FAIL | N issues |
| CI/CD Pipeline | PASS/FAIL | N issues |
| Deployment Strategy | PASS/FAIL | N issues |
| Monitoring | PASS/FAIL | N issues |
| Security | PASS/FAIL | N issues |

## Overall Deployment Readiness: READY / NOT READY

## Issues (detailed)
### {category}
- {description} — Fix: {suggested fix}

## Pre-Deployment Checklist
- [ ] All tests pass
- [ ] Feature flag configured
- [ ] Smoke tests ready
- [ ] Rollback plan documented
- [ ] Monitoring dashboards ready
- [ ] Team notified of deployment
```
