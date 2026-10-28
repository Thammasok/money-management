# gitops-repo (template)

> The GitOps/IaC **deploy target** — the repo **this harness lives inside**. Bootstrapped from the
> read-only [ai-guidelines](./ai-guidelines.md) template. Concrete values (repo name, GCP project,
> cluster, namespace, service names) live in this repo's own `terraform/terraform.tfvars` and the
> per-run `infra-epic.md` — **not** here. This doc describes the generic shape; fill in `<placeholders>`
> per environment.
> Related: [Deploy Infra Flow](../infra/deploy-infra-flow.md) · [/vibe-infra skill spec](../infra/vibe-infra-skill.md)

## Purpose
GitOps + Infrastructure-as-Code repo that provisions the GCP/GKE infrastructure for a project
(Terraform) and holds the production Helm values that drive its service deployments. Each project
adopts a copy of the `ai-guidelines` template as its own `<gitops-repo>` and fills in the values.

## Repository layout
```
<gitops-repo>/
├── .github/workflows/   infra-deploy · backend-deploy · frontend-deploy · gitops-deploy · gitops-config-deploy
├── helm-centralize/     centralized Helm chart (from the template; values.schema.json contract)
├── production/<ns>/     helm-values/<svc>-values.yml + config/ (namespace, ExternalSecret, ConfigMap)
├── runner-images/       ARC runner Dockerfiles
└── terraform/           1-…12, 14-priority-classes (+ optional Cloud SQL); variables.tf + terraform.tfvars
```

## Key configuration (`terraform/terraform.tfvars` — the live input, per project)
| Variable | Value |
|----------|-------|
| `project_id` | `<gcp-project>` |
| `region` | `<region>` (e.g. `asia-southeast1`) |
| `vpc_network_name` / `subnet_name` | `<vpc>` / `<subnet>` |
| `gke_cluster_name` | `<gke-cluster>` (zones `-a/-b/-c`) |
| Node pools | `regular-pool` (`n2-standard-2`, label `pool: regular`) + `runner-pool` (`e2-standard-4` preemptible, taint `pool=runner:NoSchedule`) |
| `app_secret_id` | `<app-secrets-container>` (shared, once-per-cluster) |
| `external_secrets_gsa_id` | `<eso-gsa>` (ESO GSA, WI-bound) |
| Runner scale sets | `gha-runner-default-<gke-cluster>` · `gha-runner-dind-<gke-cluster>` |

## Managed resources (highlights — read the repo's `terraform/README.md` via the GitHub MCP)
- **Network/GKE**: VPC, Cloud Router + NAT, static IPs, private GKE cluster (Workload Identity),
  `regular-pool` + `runner-pool`.
- **Secrets/WI**: ESO GSA; Terraform-made `app-secrets` container. The cluster-wide **`bootstrap`**
  secret (TLS cert/key + GitHub token) is created & seeded **manually** (not Terraform); ESO maps it to
  a cluster-wide TLS secret and a `github` secret in `arc-runners`.
- **Helm workloads** (`10-apps.tf`): Reloader, External Secrets Operator, `secrets-bootstrap`, Kong
  (DB-less), ARC controller + default & dind runner scale sets.
- **PriorityClasses** `tier-0..4` (`14-priority-classes.tf`) — required on every workload.
- **Cloud SQL** _(optional)_: Postgres instance + proxy GSA/KSA — passwordless (WI + IAM DB auth).
- **Cloudflare Pages** _(optional, frontend)_ — account/zone IDs supplied at apply via `TF_VAR_cloudflare_*`.
- **Artifact Registry** `kubernetes` (app images) + `portal` (runner images) — out-of-band, NOT Terraform-managed.

## CI/CD workflows
| Workflow | Trigger | Role |
|----------|---------|------|
| `infra-deploy.yml` | push to `master` under `terraform/**` | Provision/update GCP infra (Terraform apply) |
| `backend-deploy.yml` | reusable (called by a service repo's `trigger-backend-deploy.yml` on `v*`) | Build → GAR, bump `deployment.tag`, `helm upgrade --install` via `helm-centralize` |
| `frontend-deploy.yml` | reusable (called by `trigger-frontend-deploy.yml` on `v*`) | Build SPA → Cloudflare Pages (Wrangler) |
| `gitops-deploy.yml` | push under `production/*/helm-values/**` | Helm deploy on values change |
| `gitops-config-deploy.yml` | push under `production/*/config/**` | Apply raw manifests |

## Notes
- **Never `terraform apply` locally** — CI/CD only (push `terraform/**` → `master`). Local = dry-run.
- **Terraform remote state**: GCS bucket `terraform-<gcp-project>` (must pre-exist; SA needs `storage.objectAdmin`).
- **Bootstrap caveat**: the first infra run has no self-hosted runners yet → runs on GitHub-hosted
  `ubuntu-latest`; Terraform then creates the ARC scale sets.

## Team
- **Owner**: Platform / Infra
