---
name: jest-process-env-timezone-ci-trap
description: Assigning process.env.TZ inside a Jest test does not change the real zone, so zone-dependent tests pass only on a dev machine east of UTC and fail on a UTC CI runner; how to detect it and where to pin the zone
metadata:
  type: project
---

Inside Jest, `process.env.TZ = 'Asia/Bangkok'` leaves the real process zone unchanged. Probed on Node 24.22.1: `new Date(2024, 1, 29)` stayed `2024-02-29T00:00:00.000Z` after the assignment in a Jest test, while the same assignment in plain `node -e` gave `2024-02-28T17:00:00.000Z`. F-2's `backend/test/ledger.repository.int-spec.ts` IT-01 ("premise: pg's default DATE parser WOULD have moved the day") therefore passes only on a machine that is already east of Greenwich. The developer's Mac is Asia/Bangkok (`date +%Z` prints `+07`), so every earlier track was green; in a UTC container it fails (189/190), with or without `apk add tzdata` (a diagnosed environment-dependent test, not a broken environment).

**Why:** found in the deployment track by running the suites in a clean `node:24.22.1-alpine3.24` container (UTC), the closest local proxy for a GitHub `ubuntu-latest` runner. Earlier tracks only ran on the host, whose zone masks the bug.

**How to apply:**
- When a feature has date or zone-sensitive tests, run them in a UTC Node 24 container (recipe: the last bullet of node-npm-lockfile-lts-pin, plus `-e TEST_DATABASE_URL=postgresql://test:test@host.docker.internal:15432/money_management_test` for the integration suite; start the database with `up -d --wait postgres` then `run --rm -T migrations`) and again with `-e TZ=<the dev zone>`; compare. Check `date +%Z` on the host first.
- Pin the zone at process level, never inside a test: a CI step `env: TZ: Asia/Bangkok`, or `process.env.TZ = '…'` at the top of the jest config file (it runs in the real process, and workers inherit it). F-2 pins it on the `Backend integration tests` step of `.github/workflows/ci.yml`; the root-cause fix (a line in `backend/test/jest-int.config.cjs`, and retitling the two `America/Los_Angeles` rows that also run in the pinned zone) was handed off as H-13. Remove the CI pin once the config sets the zone.
- Frontend unit tests, backend unit tests, Bruno and Playwright were zone-insensitive in F-2 (the Web App builds dates from local components and tests use the same construction); recheck for any new feature that formats or compares dates.
