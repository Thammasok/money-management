---
description: Infra deploy skill 1 of 4 — provision/update GCP/GKE infrastructure via Terraform in the gitops repo (network, cluster, node pools, secrets/ESO, Kong, runners, Cloudflare Pages, Cloud SQL). Invoked by the infra-deploy agent for a `C-n` (infra) component. Never applies locally.
user-invocable: false
---
# deploy-terraform (skill 1/4)

## Type
Execution skill invoked by the **`infra-deploy`** agent for an **infra (`C-n`) component**. Provisions
GCP/GKE by editing `terraform/**` **in place** in the gitops repo (the repo the harness lives in) →
dry-run → PR/push → CI (`infra-deploy.yml`) applies → verify. Never `terraform apply` locally.

## Mechanics — do NOT duplicate here
The authoritative pipeline + resource docs live in the **`ai-guidelines` template repo** (its repo/URL
is recorded once in `.claude/company/repos/ai-guidelines.md`). Read + follow these via the GitHub MCP;
don't restate them:
- `terraform/README.md` — Terraform IaC
- `.github/workflows/README-INFRA-DEPLOY.md` — infra pipeline
- `CLAUDE.md` (root) — agent conventions

## Explore first + optional components — ASK before building the unsure
Before writing any `terraform/**`, **explore the target app repo** (via GitHub MCP) to decide which
components the app actually needs, then provision only those:
- **Cloudflare Pages** (`12-cloudflare-pages.tf`, `cloudflare_*` vars) — ONLY if a frontend/Pages service
  exists (`ai-guidelines`: "for backend-only setups, remove this file"). Backend-only ⇒ omit.
- **Cloud SQL** (Postgres instance + proxy GSA/KSA) — ONLY if the app needs a database.
- Other optional resources per the plan.

**If a component's necessity is uncertain — STOP and ask the user before provisioning it.** Never create
infrastructure speculatively. (Certain-required components proceed; uncertain/optional ones are a
human gate — `plan-infra` should have flagged them as "decisions to confirm," but if one reaches here
unresolved, halt and ask.)

## Steps
1. **Read state** — confirm the current `terraform/**` (in-tree) + prerequisites (state bucket, WIF,
   seeded `bootstrap` secret, Artifact Registry `kubernetes`/`portal`). Missing hard prereq → Blocker.
2. **Edit in place** — make the planned change on a feature branch off `master`, scoped to the component.
3. **Dry-run** — `terraform init -backend-config="bucket=terraform-<project>"` → `validate` → `plan`.
   A destructive/unexpected diff not in `infra-epic.md` → **DRIFT**, stop and surface the plan.
4. **PR + notify** — open a PR (always `PR-and-merge`; `master` is protected, no direct-push), then
   ping the user: `bash .claude/scripts/notify-slack.sh "📦 vibe-infra: PR for {component} → {PR URL} — review & merge to apply."`
   Merging the `terraform/**` change triggers `infra-deploy.yml`.
5. **Watch** the Action to completion (GitHub MCP `actions_list`/`actions_get`/`get_job_logs`); a failed
   run → Blocker.
6. **Verify vs plan** — read-only CLI (`gcloud container clusters get-credentials …` first):
   `gcloud container clusters describe <cluster> --region <region> --format=value(status)` ·
   `kubectl get nodes -L cloud.google.com/gke-nodepool` · `kubectl get <kind> -n <ns>` ·
   `kubectl rollout status deployment/<name> -n <ns> --timeout=300s`. Never mutate the cluster by hand
   (`.claude/rules/infra-discipline.md` § Verification). Mismatch → **DRIFT**.

## Guardrails
Binding rules load from `.claude/rules/infra-discipline.md` (CI/CD-only apply, in-place edits, protected
`master`, never commit secrets).
