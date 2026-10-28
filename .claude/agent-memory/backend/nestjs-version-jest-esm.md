---
name: nestjs-version-jest-esm
description: Why this repo's backend is on NestJS 11 (not 12) and how ts-jest/TypeScript versions interact; read before touching backend dependencies
metadata:
  type: project
---

The backend (`backend/`) is pinned to **NestJS 11.2.x** (+ `@nestjs/cli` 11, TypeScript 6.0.x, Jest 30, ts-jest 29.4), not 12.x.

**Why:** NestJS 12's packages are ESM-only. Jest 30 only `require()`s ESM when `vm.SourceTextModule` exists, i.e. when Node runs with `--experimental-vm-modules` (verified on Node 26.9: `undefined` without the flag), and the harness unit gate runs a plain `npx jest`. A project `.npmrc` with `node-options=--experimental-vm-modules` does reach `npx`/`npm run`, but it also taints `start:prod`; transforming `@nestjs/*` to CJS is not viable (`@nestjs/common/utils/load-package.util.js` uses `import.meta`). The NestJS docs' "Jest works on Node >= 24.9" omits the flag.

**How to apply:**
- Later features keep `@nestjs/*@^11`. Moving to 12 = a dedicated chore (ESM + Vitest + `.js` import extensions), not a casual "update to latest".
- ts-jest 29 supports `typescript <7`; the repo root has TypeScript 7 (for `e2e:typecheck`). Running Jest/ts-jest with cwd = repo root resolves root TS 7 and fails ("does not expose the JavaScript compiler API") — always run via `npm --prefix backend …` (cwd = backend).
- `module: nodenext` makes ts-jest demand `isolatedModules: true`; Jest then only transpiles, so `npm --prefix backend run typecheck` is the real type check. Interfaces imported into decorated classes need `import type` (TS1272).
- `@node-rs/argon2` exports `Algorithm` as an ambient `const enum` — unusable under `isolatedModules`; rely on the default (argon2id) and assert the `$argon2id$` prefix instead.
