---
description: Infra deploy skill 3 of 4 — wire a backend service to deploy through the gitops repo's reusable backend-deploy.yml (Helm values + ExternalSecret in the gitops repo) and open a trigger-workflow PR in the target app repo. Invoked by the infra-deploy agent for an `S-n` backend service.
user-invocable: false
---
# deploy-backend (skill 3/4)

## Type
Execution skill invoked by the **`infra-deploy`** agent for a **backend service (`S-n`)**. It scaffolds a
service into the tag-driven backend pipeline: build → GAR → bump GitOps values → Helm (via
`helm-centralize`). Runs after skills 1–2 (cluster + platform workloads exist). **DB is NOT created
here** — skill 1 (terraform) provisions Cloud SQL; this skill only *wires* the app to it.

## Mechanics — do NOT duplicate here
Read + follow the authoritative docs in the **`ai-guidelines` template repo** (repo/URL in
`.claude/company/repos/ai-guidelines.md`) via the GitHub MCP:
- `.github/workflows/README-BACKEND-DEPLOY.md` — reusable backend pipeline
- `.github/workflows/service/backend/README-TRIGGER-BACKEND-DEPLOY.md` — service trigger template
- `helm-centralize/README.md` — chart contract

## Steps
1. **Explore the target app repo** (via GitHub MCP) — its Dockerfile, tagged `.env.example`, structure.
2. **In the gitops repo (in place)** author `production/<ns>/helm-values/<svc>-values.yml` from the
   chart schema: `deployment.name`, image (`…/kubernetes/<svc>`), ports, resources, `priorityClassName`
   (`tier-0..4`), `labels`. If the app uses Cloud SQL, add the cloud-sql-proxy sidecar + KSA/WI wiring
   (the instance itself came from skill 1).
3. **Env split** (see `create-deployment-config` §6 + `infra-deploy` S-n): from the app's tagged
   `.env.example`, route `# config` → `extraEnv`/ConfigMap; `# secret` → a key in GCP Secret Manager
   `<svc>-secrets` + an `ExternalSecret` in `production/<ns>/config/` + `extraEnvSecret`. Untagged ⇒
   secret (fail-safe). Never commit a secret value.
4. **Trigger workflow → PR to the target app repo** (the ONLY write to that repo): add
   `.github/workflows/trigger-backend-deploy.yml` (`APP_NAME`, `NAMESPACE`, `DOCKERFILE_PATH`) from the
   template. **Open a PR, then notify the user to review it — never merge it yourself:**
   `bash .claude/scripts/notify-slack.sh "🔁 vibe-infra: trigger PR in {app-repo} for {svc} → {PR URL} — review & merge to enable deploys."`
   The `v*` tag cannot deploy until this PR is merged → treat as a gate: pause this service there.
5. **Verify** once the app cuts a tag: image in GAR, values bumped, rollout Ready —
   `kubectl rollout status deployment/<svc> -n <ns> --timeout=300s` + `kubectl get pods -n <ns>`
   (`kubectl logs` / `kubectl get events -n <ns>` to diagnose a stall). Mismatch → DRIFT.

## Guardrails
`.claude/rules/infra-discipline.md` — target repo is read-only EXCEPT the single trigger-workflow PR
(request review, never merge); never commit secrets; CI/CD-only.
