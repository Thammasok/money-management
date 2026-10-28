# Git Flow — CRITICAL

Binds every session and agent that runs git in an **application repo** (the `develop` / task-kind
pipelines, the `vibe-workflow` committer). It does NOT apply to the gitops/infra repo — that one has
no `develop`, and `.claude/rules/infra-discipline.md` governs it (PR-and-merge straight to protected
`master`; the CI apply path owns the result).

## Two long-lived branches, two environments

| Branch | Environment | How it deploys | Who commits on it |
|---|---|---|---|
| `develop` | **dev** — internal testing | every push to remote `develop` | nobody — it only ever receives **merges** |
| `main` / `master` (the repo's default branch) | **prod** | a human cuts a `vX.Y.Z` tag on it | nobody — it only ever receives **merged PRs** |

`main` and `master` are the same role under two names; read which one this repo uses from
`git symbolic-ref refs/remotes/origin/HEAD` once and call it the **release branch** below.

`develop` is a **testing sink, not a promotion step**: work reaches the release branch from the
working branch, never from `develop` — **merging `develop` into `main`/`master` is forbidden**. So `develop` is allowed to contain things that never ship
(abandoned branches, experiments), and it is periodically **reset to the release branch by a human**
(a force-push agents can't and mustn't do). Never assume `develop` is a superset of the release
branch or vice versa.

## A working branch's life

1. **Branch from the release branch**, never from `develop`: `feat/{feature}`, `fix/{task}`,
   `chore/{task}` (vibe mode stacks `feat/F-2` off `feat/F-1`'s tip — still rooted in the release
   branch, never in `develop`). All commits go here.
2. **Commit** per completed track / micro-step; stage only that step's files, never `git add .`.
3. **Merge into `develop` → dev deploys** (the exact sequence is below). Do this every time a commit
   lands that changes runnable code — that is what puts the change on the dev environment for the
   team to test.
4. **Open the PR to the release branch right away** (GitHub MCP `create_pull_request`, `head` = the
   working branch, `base` = the release branch). It waits there while dev testing happens; a human
   merges it once dev is good. Don't hold the PR back for dev testing — an unattended run has nobody
   to release it later, and a waiting PR costs nothing.
5. A human merges the PR and cuts the tag. **The harness never tags, never merges to the release
   branch, never deletes branches.**

Merging into `develop` and opening the PR are the same step in this harness: **"ship this state"**.

## The merge-into-develop sequence (one command per Bash call — bash discipline binds)

Preconditions: the working branch is checked out and `git status --porcelain` prints nothing.

```
git fetch origin
git checkout -B develop origin/develop
git merge --no-ff {working-branch} -m "merge({working-branch}): into develop for dev testing"
git push origin develop
git checkout {working-branch}
```

- `checkout -B develop origin/develop` deliberately **replaces** local `develop` with the remote:
  nobody commits on `develop`, and every merge is pushed immediately, so a local `develop` that
  differs from remote is stale (or a human reset it) — never something to preserve.
- `--no-ff` keeps one merge commit per shipped state, so `git log develop --merges` reads as the dev
  deploy history.
- **Always end on the working branch.** The next commit must land on `feat/x`, not on `develop`.
  If anything in the sequence fails, `git checkout {working-branch}` is still the last command.

### On a merge conflict: abort, don't resolve

```
git merge --abort
git checkout {working-branch}
bash .claude/scripts/notify-slack.sh "⚠️ {working-branch}: merge into develop conflicted — dev deploy skipped, needs a human. PR to {release-branch} still opened."
```

Then record a **Blocker** (`track-handoffs.md` for a feature; the in-chat/PAUSE report for a task), and
**continue**: still open the PR to the release branch, and say in its body that the dev merge is
pending. A conflict on `develop` means another branch changed the same code — a person decides how
they combine, not an autonomous run. The Fix Budget does not apply here: one attempt, then hand off.

## Never

- **Never merge `develop` into the release branch — in any form.** No PR with `head: develop`, no
  local `git merge develop` while on `main`/`master`, no "release from develop". `develop` may hold
  abandoned and untested work, so promoting it would ship code no PR ever showed a reviewer. The
  ONLY way code reaches the release branch is a PR from the working branch that was tested on dev.
- **Never commit on `develop` or the release branch.** Every `git commit` runs on a working branch.
- **Never merge `develop` into a working branch.** `develop` carries other people's untested,
  unreleased work; it would ride into your PR to the release branch. If a working branch needs to
  catch up, merge the **release branch** into it (or ask a human to rebase).
- **Never make `develop` a PR's `base`** — the PR goes working branch → release branch; `develop`
  is reached by merge only.
- **Never resolve a `develop` merge conflict yourself** — abort, Blocker, Slack (above).
- **Never `git tag`, never `git push --force`, never delete a branch** — those are human actions.
- **Never hand-edit deploy state to "help" a deploy** (the same rule as infra: the pipeline owns what
  `develop` and a tag produce).

## Why it's shaped this way

Dev testing happens on a **shared** environment, so the team needs one branch that means "what is
on dev right now" — that's `develop`. Prod must be reproducible from a tag, so the release branch
must contain **only reviewed, merged work** — that's why nothing goes there except a PR from the
working branch, and why `develop` (which may contain abandoned work) can never be the source of a
release. The two rules that make this safe are the ones easy to skip under time pressure: **branch
from the release branch, and never merge `develop` back into a working branch** — break either and
untested work leaks into a release with no PR that ever showed it.
