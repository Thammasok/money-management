# Deploy Infra Flow

> The end-to-end deployment mechanics for a project on GCP/GKE (generic — fill in `<gitops-repo>` / `<gcp-project>` / `<ns>` per environment).
> Source of truth: the project's **GitOps repo** ([gitops-repo](../repos/gitops-repo.md) — the deploy target, bootstrapped from the template). Conventions/templates are the separate read-only [ai-guidelines](../repos/ai-guidelines.md) template repo, read via the GitHub MCP.
> Repo detail: [gitops-repo](../repos/gitops-repo.md) · [ai-guidelines](../repos/ai-guidelines.md) · Skill spec: [/vibe-infra](./vibe-infra-skill.md).

There are **two pipeline families** (all workflows live in the GitOps repo `.github/workflows/`):

1. **Infra pipeline** (`infra-deploy.yml`) — provisions/updates GCP infra with Terraform.
2. **Service + GitOps pipelines** — `backend-deploy.yml` / `frontend-deploy.yml` (reusable, called from a
   service repo) plus `gitops-deploy.yml` / `gitops-config-deploy.yml` (apply on GitOps-repo changes).

---

## A. Infra Pipeline — `infra-deploy.yml` ("Terraform Deploy GCP")

```
edit terraform/**  ──push──▶  master  (path filter: terraform/**)
                                 ▼
                    ┌────────────────────────────┐
                    │ job: terraform              │  runs-on: ubuntu-latest (ALWAYS —
                    │  checkout                   │  this workflow PROVISIONS the self-
                    │  setup-terraform / node     │  hosted runners, so it cannot use them)
                    │  auth to GCP (WIF)          │
                    │  init -backend-config=…     │  ← GCS bucket terraform-<project>
                    │  validate → plan            │
                    │  apply -auto-approve        │  ← only on push to master
                    └────────────────────────────┘  → GCP/GKE resources created/updated
```

| Aspect | Value |
|--------|-------|
| **Trigger** | `push` to `master` filtered to `terraform/**`; also `workflow_dispatch` |
| **Runner** | `ubuntu-latest` (GitHub-hosted) — **always**, by design (it creates the self-hosted runners; the file comment says "do not switch to a self-hosted label") |
| **Auth** | WIF — `workload_identity_provider: secrets.<PROJECT_ALIAS>_WIF_PROVIDER`, `service_account: vars.<PROJECT_ALIAS>_GITHUB_GCP_SA`, `project_id: <gcp-project>` |
| **Env** | `GCP_PROJECT_ID`, `TF_WORKING_DIR=./terraform`; `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` (pass `TF_VAR_cloudflare_account_id`/`_zone_id` from org secrets when using Cloudflare) |
| **State backend** | GCS bucket `terraform-${GCP_PROJECT_ID}` via `init -backend-config=…` (no `backend.tf`). Must pre-exist; SA needs `storage.objectAdmin`. |
| **Steps** | checkout → setup-terraform → setup-node → auth → `init` → `validate` → `plan` → `apply -auto-approve` |
| **Apply gate** | `if: github.ref == 'refs/heads/master' && github.event_name == 'push'` |
| **Concurrency** | group `terraform-gcp-${github.ref}`, `cancel-in-progress: false` |
| **Permissions** | `contents: read`, `id-token: write` (WIF) |

### Manual post-deploy step (required once) — the `bootstrap` secret
Terraform does **not** manage the cluster-bootstrap secret. Create and seed the **`bootstrap`** GCP
Secret Manager secret by hand, or ESO `ClusterExternalSecret` resources stay in `Binding`/`SyncError`:
```bash
gcloud secrets create bootstrap --replication-policy="automatic"
# JSON payload must contain tls.crt, tls.key, github-token (ESO templates read these keys):
gcloud secrets versions add bootstrap --data-file=/path/to/secret.json
```
ESO then maps `tls.crt`/`tls.key` → cluster-wide TLS secret `test-secret`, and `github-token` → the
`github` secret in `arc-runners`. (Terraform separately makes an empty `app-secrets` container for app
workloads; per-app secrets are `<svc>-secrets` via an `ExternalSecret` in `production/<ns>/config/`.)

> **Rule:** never `terraform apply` locally. Local is **dry-run only**: `init -backend-config=… → validate → plan`.

---

## B. Service + GitOps Pipelines

A service deploy is **tag-driven from the service repo**, which calls a **reusable** workflow in the
GitOps repo. There is no single `service-deploy.yml` — backend and frontend are separate.

```
service repo: push tag vX.Y.Z
   │  trigger-backend-deploy.yml / trigger-frontend-deploy.yml  (caller, lives in the service repo)
   ▼  uses: <gitops-repo>/.github/workflows/{backend,frontend}-deploy.yml
   │
   ├─ backend-deploy.yml (reusable) ─────────────────────────────────────────────
   │   build-and-push   runs-on gha-runner-dind-<cluster>: buildx (mirror.gcr.io) →
   │                    WIF auth → gcloud auth configure-docker → push REGISTRY/APP:TAG (+cache)
   │   update-values    runs-on gha-runner-default-<cluster>: checkout GitOps repo (TOKEN_GITHUB) →
   │                    yq .deployment.tag = TAG in production/<ns>/helm-values/<app>-values.yml →
   │                    commit "… [skip ci]" → push master   (→ triggers gitops-deploy.yml)
   │   deploy           helm upgrade --install <app> -n <ns> -f <values> using the in-repo
   │                    helm-centralize chart (per the repo README's backend Deploy stage)
   │
   └─ frontend-deploy.yml (reusable) ────────────────────────────────────────────
       pages-deploy     runs-on gha-runner-dind-<cluster>: setup-node → npm ci → npm run build →
                        wrangler pages deploy <PAGE_OUTPUT_DIR> --project-name <PROJECT_NAME>
```

Plus two GitOps-repo-change pipelines:
- **`gitops-deploy.yml`** — on push under `production/*/helm-values/**`: `helm upgrade --install` the
  changed service (handles direct values edits / the `[skip ci]` bump above).
- **`gitops-config-deploy.yml`** — on push under `production/*/config/**`: `kubectl apply` the raw
  manifests (namespace, `ExternalSecret`, ConfigMap).

| Aspect | Value |
|--------|-------|
| **Trigger** | service repo pushes a semver tag `v[0-9]+.[0-9]+.[0-9]+` → its `trigger-*-deploy.yml` calls the reusable workflow |
| **Image (backend)** | `REGISTRY = asia-southeast1-docker.pkg.dev/<project>/kubernetes`; `IMAGE_NAME = <APP_NAME>`; `TAG = vX.Y.Z` (else `<ref>-<sha>`). Auth via WIF + `gcloud auth configure-docker` (no static registry key). |
| **Helm chart** | in-repo `helm-centralize/` (no `values.yaml`; `values.schema.json`-validated; `priorityClassName` ∈ `tier-0..4`). `RELEASE_NAME = <APP_NAME>` |
| **Frontend** | builds the SPA and deploys to **Cloudflare Pages** via Wrangler (`PROJECT_NAME`, `PAGE_OUTPUT_DIR`); needs `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` |
| **GitOps target** | `TARGET_REPO = <GITOPS_REPO>` (`<org>/<gitops-repo>`), `TARGET_BRANCH = master`, `VALUES_FILE_PATH = production/<ns>/helm-values/<app>-values.yml` |

> The `[skip ci]` marker on the values-bump commit prevents the bump from re-triggering pipelines.

---

## C. Secrets & Variables (consolidated)

| Name | Kind | Used by | Purpose |
|------|------|---------|---------|
| `<PROJECT_ALIAS>_WIF_PROVIDER` | Secret | both | WIF provider ID — GitHub Actions → GCP auth. Format: `projects/<NUM>/locations/global/workloadIdentityPools/<POOL>/providers/<PROVIDER>` |
| `<PROJECT_ALIAS>_GITHUB_GCP_SA` | Variable | both | GCP service account email used with WIF |
| `TOKEN_GITHUB` | Secret | service | PAT with write access to the GitOps repo (`<gitops-repo>`) (values bump) |
| `USERNAME_GITHUB` | Variable | service | Git author name for the automated values-bump commit |
| `CLOUDFLARE_API_TOKEN` | Secret | infra + frontend | Wrangler / Terraform Cloudflare Pages auth |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | infra + frontend | Cloudflare account |

> `<PROJECT_ALIAS>` is the per-project prefix set in the workflow YAML; the `secrets.<PROJECT_ALIAS>_*` /
> `vars.<PROJECT_ALIAS>_*` names must match it exactly. Image pushes use WIF (no static `*_REGISTRY_KEY`).

---

## D. Guardrails (become the `/vibe-infra` rules)

1. **Never `terraform apply` locally.** CI/CD (push `terraform/**` → `master`) is the only apply path. Local = `init/validate/plan` dry-run only.
2. **Infra changes land via the repo.** Edit `terraform/**` in place, then PR/push to `master`; the Action applies.
3. **Service deploys are tag-driven.** Cut a `vX.Y.Z` tag in the service repo — do not hand-edit `.deployment.tag` (the pipeline does it).
4. **Keep `[skip ci]`** on automated values commits to avoid deploy loops.
5. **`priorityClassName` (`tier-0..4`) on every workload** and **validate values against `helm-centralize/values.schema.json`** — the chart has no `values.yaml`, so always deploy with `-f`.
6. **Honor prerequisites:** GCS state bucket; WIF provider + SA bound to the repo; the **`bootstrap`** secret version populated; Artifact Registry repos (`kubernetes`, `portal`) exist.
7. **Respect concurrency:** infra runs are serialized (`cancel-in-progress: false`) — don't force-cancel a running apply; a stuck state lock is resolved with `terraform force-unlock` from an authorized machine, not by deleting state.

---

## E. Prerequisites checklist
- [ ] GCP project with required APIs enabled (Compute, Storage, Container, Secret Manager, IAM, SQL Admin).
- [ ] GCS bucket `terraform-<project>` created; SA has `storage.objectAdmin`.
- [ ] WIF configured; SA bound to the GitHub repo with create permissions.
- [ ] GitHub Secrets: `<PROJECT_ALIAS>_WIF_PROVIDER`, `TOKEN_GITHUB`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- [ ] GitHub Variables: `<PROJECT_ALIAS>_GITHUB_GCP_SA`, `USERNAME_GITHUB`.
- [ ] Artifact Registry repos `kubernetes` (app images) + `portal` (runner images) created (out-of-band; not Terraform-managed).
- [ ] **`bootstrap`** Secret Manager version populated (JSON: `tls.crt`, `tls.key`, `github-token`).
