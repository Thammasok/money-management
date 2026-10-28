---
description: Infra deploy skill 2 of 4 — manage GitOps state in the gitops repo (namespace/config raw manifests + Helm values) and their pipelines (gitops-config-deploy.yml, gitops-deploy.yml). Invoked by the infra-deploy agent for a GitOps config/Helm component.
user-invocable: false
---
# deploy-gitops (skill 2/4)

## Type
Execution skill invoked by the **`infra-deploy`** agent for a **GitOps config/Helm component**. Manages
the declarative environment state under `production/<ns>/**` in the gitops repo (edited **in place**),
which the GitOps pipelines apply. Runs after skill 1 (the cluster must exist).

## Mechanics — do NOT duplicate here
Read + follow the authoritative docs in the **`ai-guidelines` template repo** (repo/URL in
`.claude/company/repos/ai-guidelines.md`) via the GitHub MCP:
- `.github/workflows/README-GITOPS-DEPLOY.md` — Helm-values pipeline
- `.github/workflows/README-GITOPS-CONFIG-DEPLOY.md` — config/raw-manifest pipeline
- `helm-centralize/README.md` — centralized chart contract

## What it owns (fixed GitOps layout — see ai-guidelines CLAUDE.md)
- **Raw manifests** at `production/<ns>/config/<name>.yml` — namespace, `ConfigMap`, `ExternalSecret`
  (`secretStoreRef.name: gcp-secret-store`). Pushed here → `gitops-config-deploy.yml` applies.
- **Helm values** at `production/<ns>/helm-values/<svc>-values.yml`. Pushed here → `gitops-deploy.yml`
  runs `helm upgrade --install` with the `helm-centralize` chart. **Validate against
  `helm-centralize/values.schema.json`** (required keys, `priorityClassName` ∈ `tier-0..4`).

## Steps
1. **Read** the current `production/**` layout (in-tree) and the chart schema (`ai-guidelines` via MCP).
2. **Edit in place** — add/adjust the namespace, ConfigMap, or `ExternalSecret`, or the service values
   file, on a feature branch. **Never commit a raw `Secret` or a real secret value** — only an
   `ExternalSecret` referencing GCP Secret Manager.
3. **PR + notify** (always `PR-and-merge`; `master` protected) → then ping the user:
   `bash .claude/scripts/notify-slack.sh "📦 vibe-infra: PR for {component} → {PR URL} — review & merge to apply."`
   On merge the matching GitOps pipeline applies.
4. **Watch** the Action (GitHub MCP); failure → Blocker.
5. **Verify** the applied resources / rollout — `kubectl get <kind> -n <ns>`,
   `kubectl get externalsecret -n <ns>` (want `SecretSynced`), `helm list -n <ns>`,
   `kubectl rollout status deployment/<name> -n <ns> --timeout=300s`. Read-only: never `kubectl apply`
   by hand, the pipeline owns cluster state. Mismatch → **DRIFT**.

## Guardrails
Binding rules load from `.claude/rules/infra-discipline.md` (never commit secrets, in-place edits,
CI/CD-only, protected `master`).
