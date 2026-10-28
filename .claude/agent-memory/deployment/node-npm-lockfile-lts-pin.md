---
name: node-npm-lockfile-lts-pin
description: Why images and CI pin Node 24 LTS - lockfiles are written by npm 12 on the dev machine's non-LTS Node 26, and Node 22's npm 10 rejects backend/package-lock.json
metadata:
  type: project
---

The dev machine runs Node 26.9 with npm 12.2.1, so every lockfile is written by npm 12. `process.release.lts` is `undefined` on 26.9.0, so Node 26 is not an LTS release and is not a production base. The npm 10.9.8 bundled with Node 22 refuses `backend/package-lock.json` (`npm ci` → "Missing: webpack@5.112.2 from lock file", a dev-only peer); the frontend lockfile passes on npm 10. Node 24's npm 11.19.1 accepts both. F-1 pins `node:24.22.1-alpine3.24` in both Dockerfiles and `NODE_VERSION` in `.github/workflows/ci.yml`.

**Why:** found by the first `docker compose build` in the deployment track, not by any earlier track (none had run `npm ci` under npm 10). `engines` fields (`>=22.12`, `>=22.22`) say nothing about npm.

**How to apply:**
- Before choosing or changing a Node pin, test the lockfiles on that toolchain: `docker run --rm -v <abs>/backend/package.json:/w/package.json:ro -v <abs>/backend/package-lock.json:/w/package-lock.json:ro -w /w node:<tag> npm ci --dry-run --no-update-notifier | tail -n 3`. The dry run prints one line per package (hundreds), so always pipe through `tail`.
- Check LTS status with `docker run --rm node:<tag> node -p "process.version + ' lts=' + process.release.lts"`.
- Keep the three pins (backend Dockerfile, frontend Dockerfile, ci.yml) identical; the Dockerfile comments carry the reason so the pin is not "fixed" back to 22.
- jsdom 30 needs Node `^22.22.2 || ^24.15.0 || >=26` (Node 24.14 prints EBADENGINE), tighter than `frontend/package.json` `engines`.
- Prove a Node-major change by running the real suites there without touching host `node_modules`: `docker run --rm -v <abs>/backend:/src:ro [-e TEST_DATABASE_URL=postgresql://test:test@host.docker.internal:15432/money_management_test] node:<tag> sh -c "cp -a /src /work && rm -rf /work/node_modules /work/dist && cd /work && npm ci --loglevel=error --no-audit --no-fund && npm run lint && npm run typecheck && npm test && npm run test:int && npm run build"`. Skip `format:check` there (the shared `.prettierrc` is at the repo root).
