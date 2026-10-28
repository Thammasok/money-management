# Company Architecture

> Update this file to reflect your company's actual system architecture.
> Each repo listed here should have a corresponding detail file in `repos/`.

## System Map

```
┌─────────────┐     HTTP      ┌─────────────┐     MQ       ┌─────────────┐
│  Frontend   │──────────────▶│  Backend    │─────────────▶│  Worker     │
│  (web-app)  │               │  (api)      │              │  (jobs)     │
└─────────────┘               └──────┬──────┘              └──────┬──────┘
                                     │                            │
                              ┌──────▼──────┐              ┌──────▼──────┐
                              │  Database   │              │  3rd Party  │
                              │  (Postgres) │              │  (Payment)  │
                              └─────────────┘              └─────────────┘
```

> Replace the diagram above with your actual architecture.

## Repos

| Repo | Purpose | Tech Stack | Team | Detail |
|------|---------|-----------|------|--------|
| web-app | Customer-facing frontend | React, TypeScript | Frontend | [Detail](./repos/web-app.md) |
| api | Core backend API | Node.js, Express | Backend | [Detail](./repos/api.md) |
| jobs | Background job processor | Node.js | Backend | [Detail](./repos/jobs.md) |
| gitops-repo | GCP/GKE IaC + GitOps Helm values (the deploy target; harness lives here) | Terraform, Helm, GKE | Platform | [Detail](./repos/gitops-repo.md) |
| ai-guidelines | Infra conventions/templates (read-only reference, via GitHub MCP) | Markdown | Platform | [Detail](./repos/ai-guidelines.md) |

> Add a row for each repo in your company.

## Integration Patterns

| Pattern | Used Between | Protocol | Notes |
|---------|-------------|----------|-------|
| REST API | web-app → api | HTTP/JSON | Synchronous request/response |
| Message Queue | api → jobs | RabbitMQ/Kafka | Async event-driven |
| Webhook | 3rd-party → api | HTTP/JSON | Inbound from external services |

> Document the patterns your company uses for inter-service communication.

## Shared Infrastructure

| Service | Type | Used By | Notes |
|---------|------|---------|-------|
| PostgreSQL | Database | api, jobs | Primary data store |
| Redis | Cache | api | Session and data cache |
| RabbitMQ | Message Queue | api, jobs | Async processing |
| Mountebank | Mock Server | all (test only) | Mock 3rd party in tests |

> List shared infrastructure that multiple repos depend on.

## Deployment Topology

| Environment | Infra | Deploy Method | Notes |
|-------------|-------|--------------|-------|
| Development | Local Docker | docker-compose | Local dev environment |
| Staging | Cloud | CI/CD pipeline | Pre-production |
| Production | GCP / GKE (`<gke-cluster>`, `<region>`, project `<gcp-project>`) | Terraform CI/CD (infra) + tag-driven Helm (services); Cloudflare Pages (frontend) | See [Deploy Infra Flow](./infra/deploy-infra-flow.md) |

> Document your deployment environments and methods.

## Infrastructure & Deployment

Production infra and deployment run on GCP/GKE via the project's **GitOps repo**
([gitops-repo](./repos/gitops-repo.md), bootstrapped from the template); infra conventions/templates are
read (read-only, via the GitHub MCP) from the separate [ai-guidelines](./repos/ai-guidelines.md) template repo:

- **[Deploy Infra Flow](./infra/deploy-infra-flow.md)** — the pipelines: Terraform infra (`infra-deploy.yml`) and service deploys (`backend-deploy.yml` → GitOps values → Helm; `frontend-deploy.yml` → Cloudflare Pages), with triggers, runners, secrets, and guardrails.
- **[/vibe-infra skill spec](./infra/vibe-infra-skill.md)** — specification for a future autonomous infra-deploy skill built on top of the flow above (analogous to `/vibe`).
