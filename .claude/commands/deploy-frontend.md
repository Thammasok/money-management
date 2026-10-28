---
description: Infra deploy skill 4 of 4 — wire a frontend app to deploy through the gitops repo's reusable frontend-deploy.yml (build SPA → Cloudflare Pages via Wrangler) and open a trigger-workflow PR in the target app repo. Invoked by the infra-deploy agent for an `S-n` frontend service.
user-invocable: false
---
# deploy-frontend (skill 4/4)

## Type
Execution skill invoked by the **`infra-deploy`** agent for a **frontend app (`S-n`)**. It scaffolds a
frontend into the tag-driven frontend pipeline: build SPA → deploy to **Cloudflare Pages** (Wrangler).
Requires the app's Cloudflare Pages project/domain/DNS to exist first — those are provisioned by skill 1
(`12-cloudflare-pages.tf`); running this before that applies will fail.

## Mechanics — do NOT duplicate here
Read + follow the authoritative docs in the **`ai-guidelines` template repo** (repo/URL in
`.claude/company/repos/ai-guidelines.md`) via the GitHub MCP:
- `.github/workflows/README-FRONTEND-DEPLOY.md` — reusable frontend pipeline
- `.github/workflows/service/frontend/README-TRIGGER-FRONTEND-DEPLOY.md` — service trigger template

## Steps
1. **Explore the target app repo** (via GitHub MCP) — build command, output dir (`dist`/`build`/`out`),
   Node version.
2. **Confirm the Cloudflare Pages project exists** (from skill 1 / `12-cloudflare-pages.tf`). If not,
   that's a prerequisite gate — it must be provisioned before this runs (Wrangler needs the project).
3. **Trigger workflow → PR to the target app repo** (the ONLY write to that repo): add
   `.github/workflows/trigger-frontend-deploy.yml` (`PROJECT_NAME`, `PAGE_OUTPUT_DIR`, `NODE_VERSION`)
   from the template. **Open a PR, then notify the user to review it — never merge it yourself:**
   `bash .claude/scripts/notify-slack.sh "🔁 vibe-infra: trigger PR in {app-repo} for {svc} → {PR URL} — review & merge to enable deploys."`
   The `v*` tag cannot deploy until merged → gate: pause this service there.
4. **Verify** once the app cuts a tag: the `frontend-deploy.yml` run succeeds and the Pages deployment
   is live (GitHub MCP for the run; the Pages URL for the result). Failure → Blocker.

## Guardrails
`.claude/rules/infra-discipline.md` — target repo is read-only EXCEPT the single trigger-workflow PR
(request review, never merge); frontend needs its Cloudflare Pages infra (skill 1) first.
