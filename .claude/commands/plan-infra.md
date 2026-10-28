---
description: Plan (or extend) the infra deployment from a raw infrastructure requirement — runs a prerequisite intake, then spawns the plan-infra agent to draft components/build-order/verification into infra-epic.md, then reviews and edits WITH you until confirmed. Planning only; does not deploy.
argument-hint: "[infra requirement]"
disable-model-invocation: true
---
# /project:plan-infra

## Stage
Planning entry point for infrastructure — runs a prerequisite intake, then drafts the deployment plan
for the **gitops repo** (the repo this harness lives in) in an isolated agent, reading `ai-guidelines` +
the target app repo via the GitHub MCP, then runs the human-in-the-loop review.
**It never deploys.** Executing the confirmed plan is a separate workflow (`/project:vibe-infra`).

## Guard
Read the user's input first. If it describes an **application feature** (UI/API/business logic) rather
than infrastructure or a deployment — stop and respond:

> "This looks like an app feature, not infrastructure. Use `/project:plan-epic` then `/project:vibe` for features."

Proceed for an infra provisioning/change request (Terraform/GCP/GKE/Helm platform workloads), or a
service deployment, or a new component to add to an existing infra plan.

## Rules — CRITICAL
- Infra discipline loads from `.claude/rules/infra-discipline.md` (CI/CD is the only apply path).
- Bash discipline loads from `.claude/rules/bash-discipline.md`.

## Execution Model — draft in an agent, review in this session
The heavy decomposition runs in its own context window; the review stays interactive here.

### Step 0 — Prerequisite intake (ask the user, then verify — BEFORE drafting)
Gather the inputs the agent can't infer, and verify access, before spawning it:
1. **Target app repo(s)** — the `owner/repo` of the service(s) to deploy (for a service deploy).
2. **Gitops repo + GCP project/region** — confirm the defaults from `.claude/company/` / the gitops
   `terraform.tfvars` (see `.claude/company/` for the org's concrete values), or take an override for a new env.
3. **Deploy mode** — **always `PR-and-merge`** (`master` is protected; no direct-push). State it; it is not a choice.
4. **Surfaces** — confirm what the app is: backend? frontend? does it need a database (Cloud SQL)? This
   scopes the optional components; the agent still verifies against the repo during exploration.
5. **MCP precondition** — verify the **GitHub MCP** can read `ai-guidelines` AND the target app repo(s).
   If either is unreachable (token expired / no access), **STOP and have the user fix it before drafting.**

Pass #1–4 to the agent as the brief in Step 1.

### Step 1 — Spawn the drafting agent
Invoke the **`plan-infra` agent** (`.claude/agents/plan-infra.md`) via the Agent tool, passing the
user's requirement (and noting it's an extension if `infra-epic.md` already exists). Wait for it to
finish. The agent reads the requirement / `CLAUDE.md` / `.claude/company/infra/deploy-infra-flow.md` /
`.claude/company/repos/ai-guidelines.md`, inspects the real `ai-guidelines` repo (GitHub MCP), drafts
`infra-epic.md` + `infra-checklist.md` (+ the `CLAUDE.md` infra line), and returns a draft summary
ending in `DRAFT READY — awaiting user review`. It does not confirm — that's Step 2.

If the agent returns the app-feature rejection instead of a draft, relay it and stop.

### Step 2 — Review & Confirm WITH the user (human-in-the-loop)
Present the agent's draft for review — do NOT deploy:
1. Summarize from the agent's return + the written `infra-epic.md`:
   - Epic name and goal; gitops repo + target app repo(s); project/region (deploys always land via `PR-and-merge` — `master` is protected)
   - Component list with build order (mark the walking-skeleton component = first reachable cluster)
   - Dependencies and per-component verification
   - Prerequisites (state bucket, WIF, seeded `bootstrap` secret, Artifact Registry `kubernetes`/`portal`)
   - The agent's **Decisions to confirm** (ambiguous calls; uncertain/optional components; runner `runs-on:` ↔ `terraform.tfvars` names)
2. Explicitly invite the user to **confirm, edit, or direct edits**: component scope, ordering,
   dependencies, verification, prerequisites. Apply edits directly to `infra-epic.md`,
   keeping `infra-checklist.md` in sync (add/remove component blocks to match the Components table).
3. Iterate until the user is satisfied.

### Step 3 — Recheck the edited plan before /vibe-infra
**If the plan was edited in Step 2**, spawn the **`plan-infra` agent in RECHECK mode** to validate
integrity — components↔checklist sync, dependency resolution, build-order validity, target
consistency, verification present, prerequisites intact. It returns `RECHECK PASS` or a list of issues.
- If issues are returned, surface them, apply fixes (with the user's direction), and recheck — loop
  until `RECHECK PASS`.
- If Step 2 ended with no edits, recheck is optional.

## Done
Once the user confirms and the plan passes recheck (or was confirmed unedited):

> "Infra plan confirmed and saved to `infra-epic.md` (checklist in `infra-checklist.md`). To deploy it
> autonomously, run `/project:vibe-infra` — it reads this plan and drives every component through the
> CI/CD pipeline end-to-end. To plan more components later, run `/project:plan-infra` again."

Do not invoke `/project:vibe-infra` yourself — starting deployment is the user's call.
