---
description: Stage 27 of 28 — create deployment/CI-CD configuration. Invoked by the deployment track agent.
user-invocable: false
---
# /project:create-deployment-config

## Stage
27 of 28 — Create Deployment Configuration

## Setup
**Role**: `roles/backend-dev.md`
**Guidelines**:
- `guidelines/feature-flag.md`
- `guidelines/simple-design.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:feature-flag` — when implementing brownfield changes
- `/project:simple-design` — when tempted to add speculative functionality

## Input
Read:
- `artifacts/{feature}/11-deployment-plan.md` — deployment strategy and plan
- Existing CI/CD configuration
- Existing Dockerfile / docker-compose files

## Task
Create or update the deployment configuration based on the deployment plan.

### 1. CI/CD Pipeline Configuration
Create/update the deployment pipeline stages:

```yaml
# Example: GitHub Actions / GitLab CI / Jenkins pipeline
stages:
  - build:
      - Install dependencies
      - Run linter
      - Run unit tests
      - Run component tests
      - Build application

  - integration-test:
      - Start backing services (docker compose -f docker-compose.backing-service.yml up -d)
      - Liquibase migrations run automatically as a Docker service (no manual CLI)
      - Run API integration tests (Bruno)
      - Run E2E tests (Playwright, parallel with per-worker DB isolation)
      - Stop backing services

  - deploy-staging:
      - Deploy via docker compose (migrations service runs Liquibase before app starts)
      - Run smoke tests against staging
      - Manual approval gate

  - deploy-production:
      - Deploy via docker compose (migrations service runs schema-only Liquibase)
      - Run smoke tests against production
      - Monitor metrics for anomalies
```

### 1.5. Docker Compose Strategy (Three-File Pattern)
The project uses three compose files for different environments:

| File | Purpose | Liquibase Contexts | Seed Data |
|------|---------|-------------------|-----------|
| `docker-compose.yml` | Production | (none) — schema only | No |
| `docker-compose-dev.yml` | Local development | `--contexts=test` | Yes |
| `docker-compose.backing-service.yml` | Test infrastructure | `--contexts=test` | Yes |

Each compose file includes a `migrations` service that:
- Uses the `liquibase/liquibase` Docker image
- Mounts `db/changelog/` as a volume
- Runs Liquibase and exits before the backend starts (`service_completed_successfully`)
- No manual Liquibase CLI needed — everything is automated via Docker

### 2. Docker Configuration (if applicable)
```dockerfile
# Multi-stage build for reproducible builds
FROM <base-image> AS builder
WORKDIR /app
COPY <dependency-manifest-files> ./
RUN <install-dependencies>
COPY . .
RUN <build-application>

FROM <base-image> AS runner
WORKDIR /app
COPY --from=builder /app/<build-output> ./<build-output>
COPY --from=builder /app/<dependencies> ./<dependencies>

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:<port>/health || exit 1

USER <non-root-user>
EXPOSE <port>
CMD ["<runtime>", "<entrypoint>"]
```

### 3. Deployment Strategy Config

#### Blue-Green
```yaml
# Kubernetes / Docker Swarm / Cloud-specific
blue:
  replicas: 3
  version: current
green:
  replicas: 3
  version: new
router:
  active: blue  # Switch to green after verification
```

#### Canary
```yaml
canary:
  steps:
    - setWeight: 5
      pause: { duration: 10m }
    - setWeight: 25
      pause: { duration: 30m }
    - setWeight: 50
      pause: { duration: 1h }
    - setWeight: 100
  analysis:
    metrics:
      - name: error-rate
        threshold: 0.01
      - name: p99-latency
        threshold: 500ms
```

#### Feature Flag
```json
{
  "feature": "{feature-name}",
  "key": "feature-{feature-name}",
  "variations": [
    { "value": true, "name": "Enabled" },
    { "value": false, "name": "Disabled" }
  ],
  "defaultVariation": "Disabled",
  "targetingRules": [
    {
      "name": "Internal Users",
      "conditions": [{ "property": "role", "op": "is", "value": "internal" }],
      "variation": "Enabled"
    }
  ]
}
```

### 4. Smoke Test Script
```bash
#!/bin/bash
set -e
BASE_URL=${1:-http://localhost:3000}

echo "Running smoke tests against $BASE_URL..."

# Health check
curl -sf "$BASE_URL/health" > /dev/null
echo "✓ Health check passed"

# Key API endpoints
curl -sf "$BASE_URL/api/{endpoint}" > /dev/null
echo "✓ API endpoint responding"

# Walking skeleton scenario verification
curl -sf -X POST "$BASE_URL/api/{endpoint}" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}' > /dev/null
echo "✓ Walking skeleton scenario working"

echo "All smoke tests passed!"
```

### 5. Monitoring / Alerting Config
Define what to monitor post-deployment:
- Error rate threshold and alert
- Latency threshold (p50, p95, p99) and alert
- Business metric baseline and alert (e.g., conversion rate)
- Resource usage (CPU, memory) threshold

### 6. Environment manifest — tag every var `# config` or `# secret`
Author (or refresh) the app's `.env.example` listing **every** runtime variable, and tag each one — this
is the **deploy contract** the infra/service deploy reads (see `infra-deploy` S-n) to route values vs
secrets. Trailing-comment convention:

```dotenv
# .env.example — `# config` vs `# secret` decides where each var lands at deploy time.
NODE_ENV=production          # config
PORT=3000                    # config
LOG_LEVEL=info               # config
DATABASE_URL=                # secret
JWT_SIGNING_KEY=             # secret
THIRD_PARTY_API_KEY=         # secret
```

- `# config` → non-sensitive; lands in Helm `extraEnv` (plain) or the namespace ConfigMap
  (`production/<ns>/config/<svc>.yml`). The **value** may be committed.
- `# secret` → sensitive; lands in **GCP Secret Manager** (key in `<svc>-secrets`) + an `ExternalSecret`
  in `production/<ns>/config/`, wired via the chart's `extraEnvSecret`. **Only the name is ever
  committed — never the value.**
- **Tag every variable.** An **untagged** var is treated as `# secret` (fail-safe — nothing sensitive
  can leak into a committed ConfigMap by omission) and flagged for the author to confirm.

### Constraints
- Reproducible build: same source → same artifact every time
- Immutable server: deploy from tested image, never modify running instance
- All config externalized via environment variables — each tagged `# config` or `# secret` (§6)
- Health checks on every service
- Smoke tests must cover walking skeleton scenario

## Output
- CI/CD pipeline configuration files
- Dockerfile (if needed)
- Deployment strategy configuration
- Smoke test script
- FeatBit feature flag configuration
- `.env.example` with every var tagged `# config` / `# secret` (the deploy contract)
- Update `artifacts/{feature}/07-development-plan.md`

## Done
Summarize:
- Pipeline stages configured
- Deployment strategy implemented
- Smoke tests ready
- Feature flag configured
- Env manifest tagged (config vs secret)

After summary, **reviewer reviews**. Ask developer to double-check and open PR if approved.
