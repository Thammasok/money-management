---
name: release-update-rollback-drill
description: Recipe to rehearse an update and a rollback of the compose release once a previous release exists - export the old release with git archive, run both releases against one project and volume, prove the new schema is backward compatible
metadata:
  type: reference
---

A deployment report cannot honestly call a rollback "tested" until a second release exists (F-1 could not; F-2 was the first). This worked end to end in about ten tool calls (builds cached after the first):

1. Export the previous release without touching git state: `git -C <repo> archive --format=tar --output=<scratch>/prev.tar <last commit of the previous feature> backend frontend db docker-compose.yml scripts .env.example`, `mkdir -p <scratch>/prev`, `tar -xf <scratch>/prev.tar -C <scratch>/prev`. (`git archive` and `tar` are plain commands; do not use `git worktree`, it writes into `.git`.)
2. Two env files in the scratchpad with the same `POSTGRES_PASSWORD`, `WEB_PORT` (use a high port such as 18080: the machine hosts other stacks) and different `APP_VERSION` (`prev`, `new`). The compose file pins `name: money-management-prod`, so both trees share one project, one network and one volume.
3. Build and start the old release from its own tree: `docker compose --env-file prev.env -f <scratch>/prev/docker-compose.yml build --quiet` (background), then `up -d --wait --quiet-pull`; run the OLD `scripts/smoke-test.sh` from that tree; sign up a long-lived User with `curl -i` and keep the `sid` value.
4. **Update**, with the README's own command from the repo: `docker compose --env-file new.env -f <repo>/docker-compose.yml up -d --build --wait`. Postgres keeps running; `migrations`, `backend`, `web` are recreated in that order (migrations exit 0 before the backend starts). Check `databasechangelog`, that the kept session still answers `/api/v1/me`, then run the NEW smoke test and create some new-feature data with the kept session.
5. **Rollback**: `--env-file prev.env -f <repo>/docker-compose.yml up -d --wait` (no `--build`; the images tagged `prev` exist). The OLD smoke test must pass on the NEW schema; the NEW smoke test must fail at its first new check (negative control for the new checks). Count the new tables and rows: they stay.
6. **Roll forward** with `new.env`; read the pre-rollback data back with the kept session; the new smoke test passes again.
7. Cleanup: `down -v`, `docker rmi` the four tags, delete the env files (throwaway password) one by one; `rm -r` on a directory is denied in the sandbox, so the exported tree stays in the scratchpad.

`up --build` prints BuildKit's whole plain-progress log (about 120 lines); acceptable once, so use `build --quiet` for the first build. Evidence worth quoting: container `StartedAt`/`FinishedAt` from `docker inspect -f '{{.Name}} started={{.State.StartedAt}} finished={{.State.FinishedAt}}'` to prove migration-before-backend ordering.

Mind the rule for future features: a changeset that alters or drops something an older image reads breaks step 5; that is the signal to split the change into expand now, contract one release later.
