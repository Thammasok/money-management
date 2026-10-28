# Infra Discipline — CRITICAL

Binds the `/vibe-infra` skill and its agents (`plan-infra`, `infra-deploy`). **Three repos** are in
play — know which is which:

- **`ai-guidelines`** — the **template / main resource** (conventions + the reusable workflows + the
  `helm-centralize` chart). **Read-only, via the GitHub MCP.** Never write to it.
- **the gitops repo** — the GitOps/IaC repo **this harness lives inside** (the org's concrete repo is
  mapped in `.claude/company/`). Holds `terraform/**`, `production/**` Helm values
  + config, and the reusable workflows. The infra agents **edit it in place** → PR → CI.
- **the target repo (app repo)** — the application/service being deployed (declared in `infra-epic.md`).
  **Read-only, via the GitHub MCP** — its Dockerfile, tagged `.env.example`, source — with ONE write
  exception: the backend/frontend skill may **open a PR** adding its `trigger-*-deploy.yml` and request
  user review (never merge). The `vX.Y.Z` tag is cut in the app repo, not from here.

These sit on top of `.claude/rules/bash-discipline.md` (every command) and
`.claude/rules/failure-protocol.md` (Stop-on-Blocker + Fix Budget).
Reference for all mechanics: `.claude/company/infra/deploy-infra-flow.md`.

## Precondition — GitHub MCP must reach both read-repos
Before the deploy skill runs, confirm the **GitHub MCP** can read **`ai-guidelines`** (the template) AND
the **target app repo** (for a service deploy). If either is unreachable (token expired / no access),
STOP and report it — never guess conventions or app structure from memory.

## Explore first; ask before provisioning the unsure
**Explore the target app repo before provisioning anything**, and include **optional** infra only when
the app actually needs it — Cloudflare Pages (`12-cloudflare-pages.tf`) only for a frontend, Cloud SQL
only if the app uses a database, the frontend skill only if there's a frontend (`ai-guidelines`' own
guidance: "for backend-only setups, remove `12-cloudflare-pages.tf`"). **If a component's necessity is
uncertain, STOP and ask the user before building the Terraform for it** — never create infrastructure
speculatively. `plan-infra` flags such components as "decisions to confirm" at plan time; if one reaches
`infra-deploy` unresolved, halt and ask.

## Read conventions + the app repo; write only the gitops repo you live in
- The company guideline docs (`.claude/company/**`, `.claude/rules/**`) and the harness internals are
  **read-only** — `harness-guard.py` blocks writes under `.claude/` except `agent-memory/`.
- **`ai-guidelines` is read-only via the GitHub MCP** — never write to it (no MCP write, no PR, no push).
- **The target app repo is read-only via the GitHub MCP, EXCEPT one PR** adding its
  `trigger-*-deploy.yml` — the backend/frontend skill opens it and **notifies the user (Slack)
  requesting review; it never merges it**. A `vX.Y.Z` tag can't deploy until that PR is merged, so treat
  it as a **gate**: pause the service there.
- **The harness lives inside the gitops repo, so the project root IS the gitops repo.** `terraform/**`,
  `production/**` Helm values, and `.github/workflows/**` are already in your working tree. Edit them
  **in place** on a feature branch off `master`, scoped to the one component — never clone the repo,
  never edit on a protected branch.
- The only files an infra agent edits are these in-tree gitops files plus its own plan/state artifacts
  (`infra-epic.md`, `infra-checklist.md`, `artifacts/infra/**`, the `CLAUDE.md` line) and
  `.claude/agent-memory/`.
- Changes reach the live infrastructure ONLY through the PR/CI apply path. NEVER apply locally, NEVER
  push to `master` directly — changes always land via a **PR** (`master` is protected).

## The three pipelines (all defined in the gitops repo)
1. **Infra bootstrap** — `infra-deploy.yml`: Terraform provisions GCP/GKE (push `terraform/**` → `master`).
2. **GitOps config + Helm** — `gitops-config-deploy.yml` (raw manifests under `production/*/config/**`)
   + `gitops-deploy.yml` (Helm on `production/*/helm-values/**`).
3. **App deploy** — reusable `backend-deploy.yml` / `frontend-deploy.yml`, triggered from the **target
   app repo** by a `vX.Y.Z` tag via its `trigger-*-deploy.yml`.

## The apply path is CI/CD only
- **Never run `terraform apply` locally / in-session.** The only apply path is `infra-deploy.yml`,
  triggered by a push to `master` touching `terraform/**`.
- Local Terraform is **dry-run only**: `terraform init -backend-config="bucket=terraform-<project>"`
  → `terraform validate` → `terraform plan`. Never `apply`/`destroy`/`force-unlock` from a session —
  a stuck state lock is a Blocker for the user.
- **Never `terraform import`, edit remote state, or touch the GCS state bucket** by hand.

## Changes land through the repo, verified by the pipeline
- Infra changes are made by editing `terraform/**` **in place** in the gitops repo on a feature branch,
  then opening a **PR** (`master` is protected — always PR-and-merge). The Action applies on merge.
- **Announce every PR to the user via Slack** — `bash .claude/scripts/notify-slack.sh "…{component} → {PR URL}…"`
  right after opening it. PR-and-merge means a human must merge for anything to apply, so a silently
  opened PR stalls the run; the notify is the signal to review/merge. (`/vibe-infra` runs via the
  command+agent path, so this explicit call is the only PR notification — there is no workflow-code hook.)
- After a push/merge, **watch the Actions run** (GitHub MCP `actions_list` / `actions_get` /
  `get_job_logs`) until it terminates. Treat a failed run as a Blocker — capture logs, stop.
- Verify the result against the plan with the **`kubectl` / `gcloud` CLIs** (see the next section).
  A mismatch between plan and reality is **DRIFT** → halt for the user.

## Verification is `kubectl` (+ `gcloud` for control-plane facts)
There is no cluster MCP. Every post-apply check is a read-only CLI call — `kubectl *` is a sandbox
`excludedCommands` entry, so it runs unsandboxed without a prompt.

- **Get credentials first** (once per session, before the first `kubectl` call):
  `gcloud container clusters get-credentials <cluster> --region <region> --project <gcp-project>`
  Requires the `gke-gcloud-auth-plugin` (`gcloud components install gke-gcloud-auth-plugin`). If
  credentials can't be fetched (no `gcloud` auth, no `roles/container.viewer`), that is a **Blocker** —
  report it; never mark a component Done unverified.
- **What to run for what:**

  | Check | Command |
  |---|---|
  | Cluster is RUNNING | `gcloud container clusters describe <cluster> --region <region> --format=value(status)` |
  | Node pools present | `gcloud container node-pools list --cluster <cluster> --region <region>` |
  | Nodes joined, per pool | `kubectl get nodes -L cloud.google.com/gke-nodepool` |
  | Resource exists / its spec | `kubectl get <kind> <name> -n <ns> -o yaml` · `kubectl describe <kind> <name> -n <ns>` |
  | Rollout finished | `kubectl rollout status deployment/<name> -n <ns> --timeout=300s` |
  | Pods healthy | `kubectl get pods -n <ns>` |
  | Why a pod isn't Ready | `kubectl logs <pod> -n <ns> --tail=100` · `kubectl get events -n <ns> --sort-by=.lastTimestamp` |
  | Helm release state | `helm list -n <ns>` · `helm status <release> -n <ns>` |
  | ESO secrets synced | `kubectl get externalsecret -n <ns>` (want `SecretSynced`) |

- **Read-only only.** `kubectl delete*` is deny-listed; never `apply`, `edit`, `patch`, `scale`, or
  `rollout restart` against the cluster from a session — the pipeline owns cluster state, the same way
  it owns `terraform apply`. A resource that needs changing is a repo change → PR → CI.
- Bash discipline still binds: one command per call, absolute paths, **no `$(…)`** — pass literal
  values (cluster/region/namespace come from `infra-epic.md`), and use `--timeout=` on
  `rollout status` rather than a polling loop.

## Service deploys are tag-driven
- A service is deployed by pushing a semver tag `vX.Y.Z` in the **target app repo** — its
  `trigger-{backend,frontend}-deploy.yml` calls the gitops repo's reusable `backend-deploy.yml`
  (build → bump GitOps values → Helm) or `frontend-deploy.yml` (build → Cloudflare Pages). Do **not**
  hand-edit `.deployment.tag` in the gitops repo's `production/**` Helm values — the pipeline owns it.
- Keep `[skip ci]` on any automated values commit, to avoid deploy loops.

## Respect the live repos
- `master` on the gitops repo is **protected** — never force-push, never bypass branch protection.
  Land changes via **PR — always** (no direct-push).
- `infra-deploy.yml` runs with `concurrency: cancel-in-progress: false`. **Never force-cancel a
  running apply** — wait for it.

## Prerequisites are gates, not assumptions
Before triggering any run, confirm (else record a Blocker and stop):
- GCS state bucket `terraform-<project>` exists; the WIF service account has `storage.objectAdmin`.
- WIF provider + SA are bound to the repo (`secrets.<PROJECT_ALIAS>_WIF_PROVIDER`, `vars.<PROJECT_ALIAS>_GITHUB_GCP_SA` — the alias is set per project).
- The **`bootstrap`** Secret Manager secret is created **and** seeded by hand (JSON: `tls.crt`,
  `tls.key`, `github-token`) — Terraform does NOT manage it; without it ESO `ClusterExternalSecret`
  resources stay in `Binding`/`SyncError`. (Terraform separately makes an empty `app-secrets` container.)
- Artifact Registry repos `kubernetes` (app images) + `portal` (runner images) exist (out-of-band).

## Never commit secrets
- No real secret values in Terraform, Helm values, commits, PRs, or artifacts — names/sources only.
