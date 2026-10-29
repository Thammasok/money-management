# Money Management

A web application for a family to record income and expense per wallet and read weekly and monthly summaries. This repository currently implements two features: **Sign Up and Sign In** (people create an account with an email and a password, sign in, and sign out) and **Record Income and Expense in a Wallet** (a signed-in User creates wallets, each in one currency, records income and expenses in them, and sees each wallet's balance and its transactions). Everything in the product requires a signed-in User. Summaries and the rest of the plan in `epic.md` are not built yet.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | NestJS 11 on Node.js 24 LTS, TypeScript 6, Express 5 |
| Database access | `pg` (raw SQL, parameterised), PostgreSQL 16 |
| Frontend | React 19, Vite 8, React Router 8, TypeScript 6 |
| Styling | Tailwind CSS 4, daisyUI 5, self-hosted Newsreader and Source Sans 3 fonts |
| Migrations and seed data | Liquibase 4.31 (YAML changelog in `db/changelog/`), run inside Docker |
| Authentication | Email and password, argon2id hashes (`@node-rs/argon2`), server-side sessions in Postgres, httpOnly `SameSite=Lax` cookie |
| Money and dates | Integer minor units in `BIGINT` (decimal strings in JSON, `Intl.NumberFormat` for display); transaction dates are plain `YYYY-MM-DD` calendar dates |
| Edge (production) | nginx 1.30 (unprivileged): serves the Web App and proxies `/api/` on one origin |
| Feature flags | None in use (FeatBit is the harness standard; this epic is greenfield) |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |
| Containers | `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` |

| Test type | Tool | Count |
|---|---|---|
| Backend unit | Jest 30 | 402 tests, 23 files |
| Backend integration (real Postgres) | Jest 30 + Supertest | 190 tests, 4 files |
| Frontend unit and component | Vitest 5 + Testing Library (jsdom) | 359 tests, 33 files |
| API contract | Bruno CLI 4.3 | 152 requests, 200 tests (two collections) |
| End to end | Playwright 1.64 (Chromium) | 38 tests, 10 files |
| Test double for the API | Mountebank 2.9 | 1 impostor with 2 stubs (`mocks/imposters.json`) |

## Features

- **Sign up**: email plus a password of 8 to 128 characters containing a letter, a number and a symbol. Emails are trimmed and lower-cased; a registered email is refused with a clear message. A successful sign-up signs the User in.
- **Sign in**: one uniform failure message whether the email exists or not. Ten failed attempts for one email within 15 minutes pause sign-in for that email for 15 minutes (HTTP 429 with the time to retry); a successful sign-in clears the count.
- **Sessions**: stored in Postgres, 30-day sliding lifetime, one per browser. Signing out ends only the current session.
- **Wallets**: a User creates a wallet with a name (1 to 60 characters), a Currency chosen from 30 supported ones (a fixed snapshot of the Frankfurter rate provider's list) and an Opening Balance (zero or negative allowed; it is not income). The Currency defaults to the last-created wallet's and cannot be changed afterwards.
- **Transactions**: an income or an expense is recorded in a wallet with an amount greater than zero, a date (pre-filled with today, never in the future) and an optional note of up to 200 characters. A wallet shows its Balance, which is derived on every read (Opening Balance plus income minus expense, exact to the minor unit, never stored), and its Transactions, newest date first.
- **Money**: amounts are integers in the minor unit of the wallet's Currency (THB has 2 digits, JPY has 0) and travel as decimal strings, so no float touches a balance.
- **Home** (signed-in only): lists the User's wallets newest first and offers New wallet and sign-out. Each wallet opens its own page. Sign In and Sign Up send a signed-in User Home; Home sends a signed-out visitor to Sign In.
- **Access rule**: a User sees and changes only their own wallets. Another User's wallet, an unknown id and a malformed id all answer the same 404.
- **Default-deny API**: every `/api/v1` route needs a session unless marked public, so later features inherit the access rule.
- **Hardening**: JSON-only request bodies (closes login CSRF), security headers, no caching of per-User responses, parameterised SQL, validation that matches the database's own limits, a bounded request nesting depth.
- **Responsive UI** that works at phone width, with designed light and dark themes.

API (all under `/api/v1`):

| Method and path | Purpose |
|---|---|
| `POST /users` | Sign up |
| `POST /sessions` | Sign in |
| `DELETE /sessions/current` | Sign out |
| `GET /me` | The signed-in User |
| `GET /currencies` | The supported Currencies, each with its code, name and minor-unit digits |
| `GET /wallets` | The User's wallets, newest first |
| `POST /wallets` | Create a wallet (`name`, `currency`, `openingBalanceMinor`) |
| `GET /wallets/:walletId` | One wallet with its Balance and all its Transactions, newest first |
| `POST /wallets/:walletId/transactions` | Record an income or an expense (`kind`, `amountMinor`, `occurredOn`, `note`, `today`) |

## Project Structure

```
backend/                NestJS API. src/identity/ (users, sessions), src/ledger/ (wallets, transactions),
                        src/rates/ (supported Currencies), src/database/ (the pg Pool), src/config/;
                        Dockerfile; .env.example
frontend/               React Web App (src/pages, components, services, money, hooks, session); Dockerfile;
                        nginx/ holds the production edge configuration
db/changelog/           Liquibase changelog: F-1/001-003 identity schema, F-1/004 seed User (context `test` only),
                        F-2/001-002 wallets and transactions schema
collection/F-1/         Bruno API suite for sign up and sign in
collection/F-2/         Bruno API suite for wallets, transactions and currencies
mocks/                  Mountebank impostor of /api/v1 (identity-api.inject.js, ledger-api.inject.js, imposters.json)
e2e/                    Playwright specs, page objects and fixtures (F-1/, F-2/), global-setup.ts
scripts/                smoke-test.sh, the post-deploy check
docs/                   ERD.md, sequence.md, BUILD-LOG.md
artifacts/              Per-feature pipeline artifacts (git-ignored working copies)
.github/workflows/      ci.yml
.claude/                XP pipeline: agents, commands, skills, hooks, rules
saas-factory/           Git submodule: the pipeline harness
docker-compose.yml                  Production-shaped stack
docker-compose.backing-service.yml  Local and test Postgres + Liquibase (Mountebank opt-in)
playwright.config.ts, package.json  Acceptance tooling at the repository root
```

## Prerequisites

- Node.js 24 LTS with npm 11 or newer. (`engines` allow Node 22.12 and later, but the npm 10 that ships with Node 22 refuses `backend/package-lock.json`.)
- Docker with Compose v2.

## Getting Started

### Development (apps on the host, backing services in Docker)

```bash
npm install                      # acceptance tooling: Playwright, Bruno CLI, Mountebank
npm --prefix backend install
npm --prefix frontend install

npm run db:up                    # Postgres 16 on localhost:15432, then Liquibase (context `test`) to completion
DATABASE_URL=postgresql://test:test@localhost:15432/money_management_test npm --prefix backend run start:dev
npm --prefix frontend run dev    # http://localhost:5173, proxies /api to :3000
```

| What | URL |
|---|---|
| Web App | http://localhost:5173 |
| API | http://localhost:3000/api/v1 |
| Postgres | `localhost:15432`, database `money_management_test`, user `test`, password `test` (local only) |
| Mountebank admin (mock mode) | http://localhost:2525 |

`npm run db:up` starts Postgres, waits until it is healthy and then runs the Liquibase migration to completion with context `test`, which includes the seed User (see Seed Credentials). (`docker compose up --wait` alone would return while Liquibase is still running, because a one-shot service has no health check.) `npm run db:reset` re-applies the changelog (idempotent), `npm run db:down` stops everything and deletes the database volume. Postgres is published on 15432 (override with `POSTGRES_PORT`) so it does not collide with a local Postgres on 5432.

To develop the Web App without the backend, run the Mountebank impostor (`npm run mocks:start`) and start the dev server with `API_PROXY_TARGET=http://localhost:4545`. `npm run mocks:build` regenerates `mocks/imposters.json`.

### Production (docker-compose.yml)

```bash
cp .env.example .env             # set POSTGRES_PASSWORD (openssl rand -hex 24); every other value has a default
docker compose up -d --build --wait
bash scripts/smoke-test.sh http://localhost:8080
```

What starts, in order: **postgres** (16, data in the `db-data` volume, not published), **migrations** (Liquibase, one-shot, `--contexts=prod`: schema only, no seed data), **backend** (the API, waits for the migration to exit successfully and for its own health check), **web** (nginx, waits for the backend). Only `web` is published: `127.0.0.1:8080` by default. `up --wait` returns only after the migration has finished.

| What | Where |
|---|---|
| Web App and API | `http://localhost:8080` (`/` is the app, `/api/v1` the API, one origin) |
| Edge health | `GET /healthz` returns 200 |
| API health | `GET /api/v1/me` returns 401 when the API is up |
| Logs | `docker compose logs`: nginx writes one JSON object per request, the API writes plain text |

Configuration is environment variables only (`.env.example`, `backend/.env.example`):

| Variable | Default | Meaning |
|---|---|---|
| `POSTGRES_PASSWORD` | none, required | Database password (secret, URL-safe characters) |
| `WEB_PORT` / `WEB_BIND` | `8080` / `127.0.0.1` | Host port and address the `web` container is published on |
| `APP_VERSION` | `local` | Image tag |
| `COOKIE_SECURE` | `true` | Session cookie `Secure` flag; `false` only for a plain-http try-out |
| `LIQUIBASE_CONTEXTS` | `prod` | `prod` = schema only. Never leave it empty (an empty filter runs every changeset, including the test seed User) |
| `TRUSTED_PROXY_CIDR` | `127.0.0.1/32` | Address range of the load balancer in front of `web`, so rate limiting sees real client addresses |

**TLS is not terminated by this stack.** The session cookie is `Secure` in production, so a browser only keeps it over https: put a TLS-terminating proxy or load balancer in front of `web`, and set `WEB_BIND=0.0.0.0` if it runs on another machine. For a plain-http try-out on `localhost`, set `COOKIE_SECURE=false` in `.env` and run the smoke test with `SMOKE_EXPECT_SECURE_COOKIE=false`.

Run **one** backend replica: the sign-in pause lock is in process.

Update to a new version (migrations run again on every `up` and are a no-op when current; new changesets are applied before the new API starts, and the changesets are additive, so the previous version keeps working against the new schema):

```bash
docker compose exec -T postgres pg_dump -U money_management money_management > backup.sql   # before a release that changes the schema
APP_VERSION=<new> docker compose up -d --build --wait
bash scripts/smoke-test.sh <base url>
```

Roll back by setting `APP_VERSION` to the previous tag and running `docker compose up -d --wait`; the database keeps every wallet and transaction. `docker compose down` keeps the database; `docker compose down -v` deletes it.

### Manual / without Docker

The supported paths are the two compose files above. To run the pieces yourself you need a PostgreSQL 16 database, a Liquibase 4.31 install to apply the changelog, and Node.js 24:

```bash
liquibase --url=jdbc:postgresql://HOST:5432/DB --username=USER --password=PASSWORD \
  --changelog-file=db/changelog/db.changelog-master.yaml --contexts=prod update     # `test` adds the seed User
npm --prefix backend run build
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB npm --prefix backend run start:prod   # PORT defaults to 3000
npm --prefix frontend run dev        # development; or `npm --prefix frontend run build` and serve frontend/dist
```

A production Web App must be served from the same origin as the API: any web server that falls back to `index.html` for client-side routes and proxies `/api/` to the backend will do; `frontend/nginx/default.conf.template` is the reference configuration.

## Running Tests

```bash
npm --prefix backend test                 # unit
npm run db:up
npm --prefix backend run test:int         # integration, needs the database (see the timezone note below)
npm --prefix frontend run test            # unit and component
npm run api:test:integration              # Bruno, every feature, against the real API on :3000 (start it first)
npm run api:test:mock                     # Bruno, every feature, against the Mountebank impostor (npm run mocks:start)
npx playwright test                       # E2E, every feature
```

- **Timezone note**: the Ledger's date round-trip integration tests need a process timezone east of UTC (the pg date parser's default only moves a day there), and a test cannot change the zone from inside Jest. Run `TZ=Asia/Bangkok npm --prefix backend run test:int` on a UTC or western machine; CI does the same.
- **E2E is self-provisioning** in its default (integration) mode: it starts Postgres, applies the changelog with the seed, builds and starts the API on :3000, starts the Vite dev server on :5173, and removes the database only if it started it. `E2E_MODE=mock` (with `npm run mocks:start` running) runs the same specs against the impostor instead. Specs run on one worker against one shared database; every test creates its own Users with unique emails.
- Inside the agent pipeline, E2E is run with `bash .claude/scripts/run-e2e.sh F-2 list` (one feature) or `bash .claude/scripts/run-e2e.sh "" list` (all).
- Static checks: `npm --prefix backend run lint | typecheck | format:check` and `npm --prefix frontend run lint | typecheck | format:check`.
- Post-deploy: `bash scripts/smoke-test.sh [base-url]` walks sign up, session, sign out, replay refusal and sign in, then creates a wallet, records an expense and reads the balance through the public edge (19 checks); it also confirms the Ledger routes refuse anonymous callers, that another User cannot see the wallet, and that the test seed User does not exist in that environment.

## Seed Credentials

Present only where Liquibase runs with context `test` (`npm run db:up`, the Playwright and Bruno runs). Production and `docker-compose.yml` never create it.

| Role | Username | Password |
|---|---|---|
| User (the only kind of account) | `seed.user@example.test` | `Seed-Pass-1` |

`db/changelog/F-1/004-seed-test-user.yaml` is the seed changeset; the wallet changesets carry no seed (every test signs up its own User). `seed-reset.sql` does not exist; E2E resets the database by re-applying the changelog (`npm run db:reset`).

## Architecture

Backend (`backend/src`), one Nest module per bounded context:

```
HTTP request
  -> securityHeaders, requireJsonBody, cookie-parser   (configure-app.ts)
  -> global SessionGuard                               (401 unless @Public())
  -> BoundedValidationPipe + DTOs                      (400, one message per broken rule)
  -> IdentityController   -> IdentityService -> IdentityRepository -> pg Pool -> PostgreSQL
                                             -> Argon2PasswordHasher, KeyedMutex (per-email sign-in lock)
  -> LedgerController     -> LedgerService   -> LedgerRepository   -> pg Pool -> PostgreSQL
                                             -> ExchangeRatesService (the 30 supported Currencies, in process)
  -> CurrenciesController -> ExchangeRatesService
```

Dependencies are injected by token (`IDENTITY_SERVICE`, `IDENTITY_REPOSITORY`, `PASSWORD_HASHER`, `SIGN_IN_LOCK`, `LEDGER_SERVICE`, `LEDGER_REPOSITORY`, `RATES_SERVICE`, `PG_POOL`, `APP_CONFIG`); controllers and services are unit-tested against interfaces with test doubles, repositories against real Postgres. Other modules read the signed-in User with `@CurrentUser()` and mark public routes `@Public()`. The Ledger never reads the `users` table, and a wallet's Balance is a sum computed in SQL on every read. The shared `pg` Pool (`database/create-pool.ts`) returns a `DATE` as the exact `YYYY-MM-DD` string, so no timezone can move a transaction's day.

Frontend (`frontend/src`):

```
pages (containers)  -> humble components (props only)
        |
        +-> useServices() -> IAuthService   -> HttpAuthService   -+
                          -> IWalletService -> HttpWalletService -+-> sendJson -> fetch('/api/v1')
money/ (typed text <-> minor units, Intl formatting, local today), hooks/use-async-value
SessionProvider + RequireSignedIn route guards; design tokens in styles/theme.css
```

The Web App holds no money rules: it converts typed text to minor units of the wallet's Currency and formats minor units back, and shows the API's own sentence for every refusal.

Production edge (`frontend/nginx/default.conf.template`): static files with a strict Content-Security-Policy, SPA fallback, `/api/` reverse proxy, per-address rate limits (sign-up and sign-in: 30 a minute, burst 10; every write under `/api/v1/wallets`: 60 a minute, burst 20), JSON access logs, non-root and read-only containers.

Data model (`wallets` belong to a User; `transactions` belong to a wallet; neither is ever deleted) and flows: `docs/ERD.md`, `docs/sequence.md`. Feature flags: none in use.

## CI/CD Pipeline

`.github/workflows/ci.yml`, on every pull request and on pushes to `main` and `develop`:

| Job | What it does |
|---|---|
| `backend` | `npm ci`, ESLint, Prettier check, `tsc`, unit tests, `npm audit --omit=dev` |
| `frontend` | `npm ci`, ESLint, Prettier check, `tsc`, unit tests, production build, `npm audit --omit=dev` |
| `integration` (after both) | Starts Postgres, runs the Liquibase migration (`test` context) to completion, backend integration tests, the Bruno suites of every feature against the real API, the Playwright E2E specs of every feature |
| `images` (after both) | Validates and builds `docker-compose.yml`, starts the production stack, runs `scripts/smoke-test.sh` |

There is no deploy job: a production release is a human-cut `vX.Y.Z` tag on `main`. Build history and per-feature changes are in `docs/BUILD-LOG.md`.

## Development Framework

Features are built by an XP pipeline of agents and commands in `.claude/` (pre-development, backend, frontend, deployment tracks, then an epic conformance gate). See `.claude/commands/develop.md` for the stages and `saas-factory/README.md` for the harness.
