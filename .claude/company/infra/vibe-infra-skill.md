# `/vibe-infra` — Skill

> **Status: IMPLEMENTED.** The command/agent/rule files exist (see *File set* below). The skill deploys
> through the **gitops repo** it lives in, reading `ai-guidelines` (template) and the **target app
> repo** read-only via the GitHub MCP.
> Grounded in: [Deploy Infra Flow](./deploy-infra-flow.md) · [gitops-repo](../repos/gitops-repo.md) (the gitops repo) · [ai-guidelines](../repos/ai-guidelines.md) (template/conventions).
> Modeled on the existing `/vibe` + `/plan-epic` pattern (`.claude/commands/vibe.md`, `.claude/commands/plan-epic.md`).

## Intent
An autonomous **infrastructure deployment** flow, analogous to `/vibe` — but instead of building an app epic feature-by-feature, it drives the **deploy infra flow** through the **gitops repo** it lives in (Terraform infra + the service deploy pipeline: image → GitOps values → Helm), reading `ai-guidelines` and the **target app repo** via the GitHub MCP. It plans the infra change, makes it in the gitops repo (in place — the harness lives there), and lets the existing GitHub Actions CI/CD do the actual `apply`/deploy, then verifies.

## Plan-then-execute split (mirrors `plan-epic` → `vibe`)

| Phase | Command | Type | Responsibility |
|-------|---------|------|----------------|
| Plan | `/project:plan-infra` | human-in-the-loop | From a raw infra requirement, draft `infra-epic.md` + `infra-checklist.md` (components + build order), review/edit WITH the user until confirmed. Plans only; never deploys. |
| Execute | `/project:vibe-infra` | autonomous | Requires a confirmed `infra-epic.md`. Reads it and drives every component end-to-end without pauses; halts on a deploy failure or drift. |
| Resume | `/project:vibe-infra-continue` | internal | Resumes mid-plan in a fresh session; invoked between components, never manually. |

### Suggested infra build order (walking-skeleton style)
`network → cluster → node pools → secret manager + ESO → platform workloads (Reloader, Kong, secrets-bootstrap) → ARC runners → Cloudflare Pages`, then per-service deploys. The thinnest end-to-end slice (one cluster + one workload reachable) first, then vertical fill-in.

## Runtime behavior

### Mode 1 — Infra change (Terraform)
```
read infra-epic.md / infra-checklist.md
  → edit terraform/** in place in the gitops repo
  → DRY-RUN locally: terraform init -backend-config=… → validate → plan   (NEVER apply locally)
  → open PR / push to master
  → infra-deploy.yml runs: init → validate → plan → apply -auto-approve
  → poll the Actions run (GitHub MCP actions_list / actions_get / get_job_logs) until success
  → verify resources (read-only CLI: gcloud container clusters describe / kubectl get nodes / kubectl get <kind> -n <ns>)
  → mark component done, advance
```

### Mode 2 — Service deploy
```
ensure production/<ns>/helm-values/<svc>-values.yml exists
  → cut & push tag vX.Y.Z in the service repo
  → watch backend-deploy.yml (build → update-values → Helm) / frontend-deploy.yml (build → Cloudflare Pages)
  → confirm rollout (kubectl rollout status deployment/<svc> -n <ns> --timeout=300s; helm list -n <ns>)
  → mark component done, advance
```

## Guardrails
Inherits **all** rules from [Deploy Infra Flow § D](./deploy-infra-flow.md#d-guardrails-become-the-vibe-infra-rules):
- Never `terraform apply` locally — CI/CD is the only apply path; local is dry-run.
- Infra changes land via PR/push to `terraform/**`; service deploys are tag-driven.
- Keep `[skip ci]` on automated values commits; respect `cancel-in-progress: false` (don't force-cancel a running apply).
- Verify WIF/secret/state-bucket prerequisites before triggering a run.
- Bash discipline (`.claude/rules/bash-discipline.md`) applies to all `gcloud`/`terraform`/`helm`/`kubectl` commands; add an `infra-discipline.md` rule when implementing.

## Inputs / Outputs
- **Reads:** `infra-epic.md`, `infra-checklist.md`, `pipeline-state.md`; the gitops repo it lives in (Terraform, Helm values); `ai-guidelines` + the target app repo via GitHub MCP; this company doc set.
- **Writes:** changes to `terraform/**` and/or `production/<ns>/helm-values/*`; an artifacts report per component (plan output, Actions run URL, verification result); updates `infra-checklist.md` as components complete.
- **External:** GitHub MCP (`actions_*`, `create_pull_request`, `get_job_logs`); the `kubectl` / `gcloud` / `helm` / `terraform` CLIs (cluster verification is CLI-only — there is no cluster MCP; `kubectl *` is a sandbox `excludedCommands` entry).

## Halt conditions (analogous to vibe's conformance DRIFT)
Stop and surface to the user when:
- `terraform plan` shows a destructive/unexpected diff not described in `infra-epic.md`.
- An Actions run (`infra-deploy.yml` / `backend-deploy.yml` / `frontend-deploy.yml`) fails — capture `get_job_logs` and stop.
- Post-apply verification disagrees with the plan (resource missing, rollout not Ready) → **DRIFT**, halt.
- A prerequisite is missing (no state bucket, WIF not bound, unseeded `bootstrap` secret).

## File set (implemented)
| File | Role | Status |
|------|------|--------|
| `.claude/commands/plan-infra.md` | human-in-the-loop infra planning command (`disable-model-invocation: true`) | ✅ |
| `.claude/commands/vibe-infra.md` | autonomous orchestrator (`disable-model-invocation: true`) | ✅ |
| `.claude/commands/vibe-infra-continue.md` | mid-plan resume (`user-invocable: false`) | ✅ |
| `.claude/agents/plan-infra.md` | planning agent — drafts `infra-epic.md` / `infra-checklist.md` (model: opus) | ✅ |
| `.claude/agents/infra-deploy.md` | deployment agent — dispatches to the 4 skills below by component type; edit → dry-run → PR/push → watch → verify (model: sonnet) | ✅ |
| `.claude/commands/deploy-terraform.md` | skill 1/4 — Terraform infra (in place in the gitops repo) | ✅ |
| `.claude/commands/deploy-gitops.md` | skill 2/4 — GitOps config + Helm values (`production/**`) | ✅ |
| `.claude/commands/deploy-backend.md` | skill 3/4 — backend service (values/secret + trigger PR to app repo) | ✅ |
| `.claude/commands/deploy-frontend.md` | skill 4/4 — frontend app (Cloudflare Pages + trigger PR to app repo) | ✅ |
| `.claude/rules/infra-discipline.md` | terraform/helm/kubectl/gcloud command discipline | ✅ |
| `.claude/workflows/vibe-infra-workflow.js` | optional deterministic component loop (mirrors `vibe-workflow.js`) | ⬜ not built — the command+agent path is the primary, working flow (as with `/develop`) |

### Plan artifacts (written at deploy time, not committed to the harness)
- `infra-epic.md` (project root) — confirmed plan: components, build order, gitops repo + target app repo/project.
- `infra-checklist.md` (project root) — per-component stage status (source of truth for next/done).
- `artifacts/infra/{component}/deploy-report.md` + `deploy-handoff.md` — per-component evidence.

## Resolved design decisions
- **Two agents** (`plan-infra` drafts, `infra-deploy` executes one component) — mirrors the
  `plan-epic` agent + track-agent split, not a single mega-agent.
- **Deploy mode is always PR-and-merge** (`master` is protected; no direct-push).
- **The harness lives inside the gitops repo**, so `infra-epic.md` /
  `infra-checklist.md` and the `terraform/**` it edits share one working tree — edited in place on a
  feature branch, never a separate clone.
