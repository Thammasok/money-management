# ai-guidelines

> GitHub: `<org>/ai-guidelines` (the org's GitOps/IaC template repo; default branch `master`)
> _**Template / blueprint repo — read-only reference**, consulted via the GitHub MCP. It is NOT a deploy target: the infra agents never write to it. You bootstrap a concrete GitOps repo ([gitops-repo](./gitops-repo.md)) FROM this template, then edit that copy in place._
> Related docs: [Deploy Infra Flow](../infra/deploy-infra-flow.md) · [/vibe-infra skill spec](../infra/vibe-infra-skill.md)

## Purpose
The **"AI GitOps & IaC Templates Guide"** — a standardized, fully-parameterized blueprint for standing up
GitOps + Infrastructure-as-Code on GCP/GKE. It is both the **convention source** and a working **GitOps
repo template**: adopters copy/rename it to `gitops-<env>` (its own README: *"this repository **is** the
GitOps repository… rename it, e.g. `gitops-<env>`"*) and fill in the placeholders.

## What it holds
| Path | Role |
|------|------|
| `terraform/` | IaC templates — VPC, Cloud NAT, GKE, node pools, Secret Manager, IAM/Workload Identity, ARC runners, Kong, ESO, Cloudflare Pages, PriorityClasses. `1-…12-` + `14-priority-classes.tf`; `variables.tf` + `terraform.tfvars` (placeholders); `charts/secrets-bootstrap/` local chart; `runner-values/`. |
| `helm-centralize/` | The single **centralized Helm chart** every microservice deploys through. **No `values.yaml`** (no implicit defaults — always `-f`); contract enforced by `values.schema.json` (required keys, `priorityClassName` ∈ `tier-0..4`, allowed `labels`). `default-value.yml` is reference only. |
| `.github/workflows/` | Reusable pipelines: `infra-deploy`, `backend-deploy`, `frontend-deploy`, `gitops-deploy`, `gitops-config-deploy`, plus `service/{backend,frontend}/trigger-*-deploy.yml` caller templates (which live in *service* repos). Each has a `README-*.md`. |
| `production/<ns>/` | EXAMPLE environment+namespace — `helm-values/*.yml`, `config/{namespace,external-secret,configmap}.yml`. Copy the pattern; don't treat as live infra. |
| `runner-images/` | Dockerfiles for the self-hosted ARC runner images. |
| `CLAUDE.md` (root) | **Authoritative, machine-loaded agent rules** — the single source of truth for conventions. If README and CLAUDE.md disagree, CLAUDE.md wins. |

## Conventions the infra agents must read & apply (from its `CLAUDE.md`)
- **Fixed GitOps path layout** — Helm values at `<env>/<ns>/helm-values/<svc>-values.yml`; raw manifests
  (ConfigMaps, `ExternalSecret`) at `<env>/<ns>/config/<name>.yml`. Never invent ad-hoc structures.
- **Never commit secrets** — always an `ExternalSecret` syncing from GCP Secret Manager, never a raw
  `Secret`/base64.
- **Runner names come from Terraform** (`github_runner_default_name` / `_dind_name`); workflows' `runs-on:`
  must match exactly.
- **Bootstrap ordering** — the first `infra-deploy.yml` run uses GitHub-hosted `ubuntu-latest` (no
  self-hosted runners exist yet); Terraform provisions the ARC scale sets.
- **`priorityClassName` (`tier-0..4`) required on every workload** — the PriorityClasses come from
  `terraform/14-priority-classes.tf`.
- **Validate values against `values.schema.json`, not the docs.**
- **Never `terraform apply` manually** — CI/CD (`infra-deploy.yml`) only; local is `init`/`validate`/`plan`.
- **WIF secret/var names must match the workflows** — the per-project alias `<PROJECT_ALIAS>` →
  `<PROJECT_ALIAS>_WIF_PROVIDER`, `<PROJECT_ALIAS>_GITHUB_GCP_SA`.
- **infra-level vs app-level ownership** — `app_secret_id` (`app-secrets`) + `external_secrets_gsa_id`
  are shared, once-per-cluster, NOT per app; a service's own secret is `<svc>-secrets` via an
  `ExternalSecret` in `production/<ns>/config/`.

## How the infra flow uses it
- **Read-only, via the GitHub MCP** (`get_repository_tree`, `get_file_contents`). No clone, no MCP write,
  no PR, no push.
- `plan-infra` folds the relevant conventions into `infra-epic.md`; `infra-deploy` applies them to the
  change it makes in the gitops repo (the adopted `gitops-<env>`).

## Data Ownership
Source of truth for: infra **conventions, templates, and reusable workflows**. Owns no live
infrastructure and no Terraform state — those belong to each adopted GitOps repo (e.g.
[gitops-repo](./gitops-repo.md)).

## Team
- **Owner**: Platform / Infra
