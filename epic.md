# Epic: Money Management

> Status: **DRAFT — awaiting user review** (drafted 2026-10-28 by plan-epic from the raw idea:
> "i want to need money management web applicationtion that manage income and expense each wallet and
> summary per weekly and monthly"). Every term and assumption below is drafted, not confirmed — see
> Open Questions & Assumptions.

## Goal
A person can keep several wallets, record each income and expense against the wallet it moved through, and read how much came in, went out, and was left over for any week or month.

## Business Value
Personal financial awareness: one place that answers "how much do I have in each wallet" and "did I spend more than I earned this week / this month" without a spreadsheet. Greenfield personal tool — the value is the user's own habit of recording, so speed of entry and trustworthy totals matter more than breadth.

## Success Metric
The user records every income and expense for one full calendar month in the app and, at month end, reads that month's income, expense, and net — overall and per wallet — on one screen, with totals that match their own reconciliation to the minor unit.
**Value today**: no tool exists (0 months recorded; summaries are worked out by hand, if at all). _(A-7 — confirm this is the metric.)_

## Out of Scope

> What a reader would reasonably assume is included, but isn't. Each line prevents a feature nobody asked for.

- **Budgets / spending limits / alerts** — the brief asks for recording and summaries, not targets. Candidate for a later epic.
- **Multiple people / shared wallets** — one person's money only (A-1). Changing this later means an owner on every record.
- **Login / accounts** — none while the app is single-person and privately hosted (A-1). Becomes in scope if it is hosted on the public internet (A-1).
- **Multiple currencies and exchange rates** — one app-wide currency (A-2). Multi-currency would need an exchange-rate provider and makes cross-wallet totals ambiguous.
- **Bank / e-wallet sync, statement import, CSV import or export** — every transaction is entered by hand.
- **Recurring / scheduled transactions** — each transaction is entered when it happens.
- **Charts and trend graphs** — summaries are numeric totals with previous/next period navigation (A-8).
- **Receipts, photos, attachments** on transactions.
- **Native mobile app** — a responsive web app only.
- **Investments, loans, debts owed to/by others, interest** — wallets hold a balance; nothing more.
- **Undo / audit history** of edits and deletes (A-5).

---

## Features

| ID | Name | Description | Surface | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|---|---|
| F-1 | Record Income and Expense in a Wallet | Create a wallet (name + opening balance), record an income or expense in it (amount, date, optional note), and see the wallet's balance and its transactions newest-first. | full | High | M | none | Planned |
| F-2 | Wallet Overview and Management | See every wallet with its current balance and the grand total across wallets; rename a wallet; archive a wallet so it stops accepting new transactions but keeps its history. | full | High | S | F-1 | Planned |
| F-3 | Edit and Delete Transactions | Correct a recorded transaction's kind, amount, date, wallet, or note, or delete it; balances reflect the change immediately. | full | High | S | F-1 | Planned |
| F-4 | Monthly Summary | For a selected calendar month, see total income, total expense, and net — across all wallets by default, or filtered to one wallet — and step to the previous/next month. | full | High | M | F-1 | Planned |
| F-5 | Weekly Summary | The same summary for a selected week (Monday–Sunday), with previous/next week navigation, from the same summary screen as F-4. | full | High | S | F-4 | Planned |
| F-6 | Categorize Transactions | Define income and expense categories, assign one (optionally) to each transaction, and see the selected period's expense and income broken down by category in the summary. | full | Medium | M | F-1, F-4 | Planned |
| F-7 | Transfer Between Wallets | Move an amount from one wallet to another as a single transfer; both balances change, and the transfer is not counted as income or expense in summaries. | full | Medium | M | F-2, F-4 | Planned |

**Effort key**: S = days, M = ~1 week, L = multiple weeks

**Surface key** — which tracks the feature runs (set **per feature**; pre-dev, deployment, and the
conformance gate always run):
- `full` — the feature has a UI and a backend change. Pre-dev → backend → frontend → live evaluation → deployment.
- `backend-only` — no UI surface (API-only service, worker, scheduled job, webhook receiver). The
  frontend track and the live-evaluation gate are skipped; the **Bruno API suite is the acceptance
  contract** in place of Playwright E2E.
- `frontend-only` — a UI over an API that **already exists** with **no backend change**. The backend
  track is skipped; Playwright E2E stays the acceptance contract.

Omitted Surface reads as `full`. Every feature here is `full`: the tech-stack profile declares both a
React frontend and a NestJS backend, and every feature is something the person sees and does on screen
backed by a stored change or a new query.

---

## Build Order

```
1. F-1: Record Income and Expense in a Wallet  ← Walking Skeleton — start here
2. F-2: Wallet Overview and Management         ← requires F-1 (parallel with F-3, F-4)
3. F-3: Edit and Delete Transactions           ← requires F-1 (parallel with F-2, F-4)
4. F-4: Monthly Summary                        ← requires F-1 (parallel with F-2, F-3)
5. F-5: Weekly Summary                         ← requires F-4 (reuses its summary screen and module)
6. F-6: Categorize Transactions                ← requires F-1 and F-4 (adds the category breakdown to the summary)
7. F-7: Transfer Between Wallets               ← requires F-2 (several wallets, archive rule) and F-4 (summaries must exclude transfers)
```

F-6 and F-7 are Medium priority and the first cut candidates (Q-2, Q-3).

---

## Shared Domain Entities

> These entities appear in multiple features. All features must use identical names and field definitions.

| Entity | Canonical Fields | Used In |
|---|---|---|
| Wallet | `id: string` (UUID), `name: string`, `openingBalanceMinor: bigint`, `archivedAt: Date \| null`, `createdAt: Date`, `updatedAt: Date` — `balanceMinor: bigint` is **derived on read, never stored** | F-1, F-2, F-3, F-4, F-7 |
| Transaction | `id: string` (UUID), `walletId: string`, `kind: 'income' \| 'expense'`, `amountMinor: bigint` (> 0), `occurredOn: string` (calendar date `YYYY-MM-DD`), `note: string \| null`, `categoryId: string \| null` (added by F-6), `createdAt: Date`, `updatedAt: Date` | F-1, F-3, F-4, F-5, F-6 |
| Period Summary _(computed, not stored)_ | `period: 'week' \| 'month'`, `startsOn: string`, `endsOn: string` (inclusive dates), `walletId: string \| null` (null = all wallets), `incomeMinor: bigint`, `expenseMinor: bigint`, `netMinor: bigint` | F-4, F-5, F-6, F-7 |
| Category | `id: string` (UUID), `name: string`, `kind: 'income' \| 'expense'` _(Q-5)_, `createdAt: Date`, `updatedAt: Date` | F-6 (owner), F-3 (edit a transaction's category once F-6 lands) |
| Transfer | `id: string` (UUID), `fromWalletId: string`, `toWalletId: string`, `amountMinor: bigint` (> 0), `occurredOn: string`, `note: string \| null`, `createdAt: Date`, `updatedAt: Date` | F-7 (owner), F-2 (balances), F-4/F-5 (excluded from totals) |

---

## Domain Language

> The words this epic uses, and the words it refuses. One canonical term per concept — every displaced
> word goes under `_Avoid_` so a reviewer can grep for it. Definitions say what a thing IS, never how it
> works. **Drafted by plan-epic; not yet confirmed by the user.**

**Wallet**:
A named place where the person's money sits — cash, a bank account, an e-wallet, a card. Every Transaction belongs to exactly one Wallet.
_Avoid_: account, pocket, fund, source

**Balance**:
How much money a Wallet holds right now: its Opening Balance plus its income, minus its expense, plus Transfers in, minus Transfers out. May be negative.
_Avoid_: total, amount, remaining

**Opening Balance**:
The money already in a Wallet on the day the person starts tracking it. It is not income.
_Avoid_: initial deposit, starting income, seed amount

**Transaction**:
One recorded movement of money into or out of a single Wallet, of Kind income or expense, on a calendar date.
_Avoid_: entry, record, item, movement, payment, ledger line

**Income**:
A Transaction Kind: money the person received into a Wallet.
_Avoid_: revenue, earning, credit, deposit

**Expense**:
A Transaction Kind: money the person spent out of a Wallet.
_Avoid_: spending, cost, debit, outflow, withdrawal

**Transfer**:
Money the person moved from one of their Wallets to another. It changes both Balances and is neither Income nor Expense.
_Avoid_: move, internal transaction, top-up

**Category**:
A person-defined label for what a Transaction was for (e.g. Food, Salary), belonging to one Kind.
_Avoid_: tag, label, type, group

**Period**:
A calendar Week (Monday to Sunday) or a calendar Month, identified by its first and last date.
_Avoid_: range, interval, cycle, timeframe

**Period Summary**:
The total Income, total Expense, and Net of a Period, for all Wallets or for one Wallet.
_Avoid_: report, statement, overview, dashboard

**Net**:
Income minus Expense within a Period. Not the same as a Balance.
_Avoid_: profit, savings, cash flow, total

**Archived Wallet**:
A Wallet the person no longer uses. It keeps its history and still counts in past Period Summaries, but accepts no new Transactions or Transfers.
_Avoid_: deleted wallet, closed wallet, inactive wallet

---

## Service Architecture

> The module and seam map for this epic — where behavior is hidden and where it can be substituted.
> Layer *roles* come from `.claude/tech-stack-profile.md` → Architecture Pattern (Controller → Service
> → Repository with `pg`); this section decides how many modules there are and where one ends.
> Method-level interfaces are Stage 11 / Stage 16, not here.

| Module | Interface — what a caller must know | Seam & adapters | Dependency category | Used by |
|---|---|---|---|---|
| **Web App** (React SPA, `frontend/`) | Screens for wallets, transactions, summaries. Holds no money logic: formats minor units for display and sends what the person typed. Talks to the backend only through its injected API services. | Frontend service interfaces (`ServiceContext`) — production adapter calls `/api/v1` over HTTP; test adapter is `createMockServices()`. Mandated layer interface. | In-process (UI) over Remote but owned (the backend API, mocked by Mountebank only in Stage 21 UI-mock runs) | F-1 … F-7 |
| **Ledger** (Nest module `ledger`, `backend/src/ledger/`) | Owns Wallets, Transactions, Categories, Transfers, and Balances. Invariants: amounts are positive integers in minor units; Kind decides direction; a Balance is always derived, never stored; an Archived Wallet accepts no new Transaction or Transfer (409); a Transfer's two Wallets differ; a Transaction's Category has the same Kind. Errors: 400 validation, 404 unknown id, 409 state conflict. | Controller → Service → Repository (mandated layer interfaces). Repository adapter: `pg` against Postgres; unit-test adapter: `jest.Mocked<I…Repository>`. | Service: In-process · Repository: Local-substitutable | F-1, F-2, F-3, F-6, F-7 |
| **Summary** (Nest module `summary`, `backend/src/summary/`) | Read-only. Given a Period (week or month containing a date) and an optional Wallet, returns a Period Summary (and, from F-6, a per-Category breakdown). Hides Period boundary arithmetic (Monday week start, month lengths) and the aggregation queries. Transfers never count as Income or Expense. Archived Wallets still count. Never writes. | Controller → Service → Repository (mandated). Repository adapter: read-only `pg` aggregation over the Ledger's tables (Q-6); unit-test adapter: mocked repository. | Service: In-process · Repository: Local-substitutable | F-4, F-5, F-6, F-7 |
| **Postgres** (PostgreSQL 16, schema via Liquibase) | The single store. Ledger owns its tables; Summary only reads them. | `PG_POOL` injected by a global `DatabaseModule`. Real via `docker-compose.backing-service.yml` in integration tests. | Local-substitutable | all |

**Dependency categories** (each fixes the test strategy — see `.claude/guidelines/deep-modules.md`):
In-process · Local-substitutable (kept real, via `docker-compose.backing-service.yml`) · Remote but owned (Mountebank impostor) · True external (Mountebank impostor).
**This epic has no True external dependency**, so no Mountebank impostor is needed for a third party; Mountebank is used only to stand in for this project's own `/api/v1` during Stage 7 / Stage 21 mock runs.

**Acceptance seam**: the browser — Playwright drives the Web App, which calls the real NestJS `/api/v1` backed by real Postgres (Stage 25). The Bruno suite drives `/api/v1` directly for the backend contract.

**Deliberately not a seam**:
- **Period calendar** (week/month boundary computation) — pure functions inside Summary; one implementation, tested through Summary's interface.
- **Clock / "today"** — the Web App pre-fills today's date from the browser; the backend never needs "now" beyond audit timestamps (database default). No clock port.
- **Exchange-rate gateway** — one currency (A-2), so no FX provider and no Gateway layer at all.
- **A separate Wallets module or Categories module** — wallets, transactions, categories, and transfers share invariants (archive rule, kind matching, balance derivation); splitting them would scatter those rules across modules (deletion test). Stage 11 may still split files inside `ledger/`.
- **Auth guard** — no login (A-1); add it only if A-1 is overturned.

---

## Architecture Decisions

> Only decisions that are **hard to reverse**, **surprising without context**, and **the result of a real
> trade-off**. All three, or leave it out — most epics record zero. A decision needing evidence first goes
> to `/project:develop-research` instead.

### AD-1 — A Transaction carries a calendar date, not a timestamp
Weekly and monthly summaries bucket by the day the person says the money moved; storing a timezone-less `DATE` (`occurredOn`) makes that bucketing exact regardless of server or browser timezone, at the cost of never knowing the time of day. A UTC timestamp was rejected because a late-evening expense would land in the next day — and sometimes the next week or month — depending on whose timezone computes the summary, and the time of day cannot be recovered later. _(Pending user confirmation — Q-4.)_

---

## Project Conventions

> All features must follow these without exception.

- **Identity key**: every entity has `id: string`, a UUID generated server-side by Postgres (`gen_random_uuid()`); references are `{entity}Id: string` (`walletId`, `categoryId`, `fromWalletId`, `toWalletId`).
- **Money**: integer minor units only — `BIGINT` columns named `*_minor`, `bigint` in backend TypeScript, and a **decimal-integer string** in JSON (`"amountMinor": "12550"`) because JSON numbers cannot carry `bigint`. Never floating point. Amounts on Transactions and Transfers are always > 0; direction comes from Kind (or from/to). One app-wide ISO-4217 currency from configuration (`APP_CURRENCY`, A-2); the Web App formats minor units with `Intl.NumberFormat` for that currency. _(Q-1)_
- **Balance**: derived on read from Opening Balance, Transactions, and Transfers; never stored, never cached.
- **Dates**: `occurredOn` is a `DATE` / `YYYY-MM-DD` string with no time and no timezone (AD-1). Audit fields `createdAt` / `updatedAt` are `TIMESTAMPTZ`, ISO-8601 UTC in JSON. A week is Monday–Sunday (A-4).
- **API shape**: REST under `/api/v1`, plural resource nouns, camelCase JSON; database tables and columns snake_case, plural table names (`wallets`, `transactions`, `categories`, `transfers`).
- **Error handling**: Nest `HttpException`s in the default `{ statusCode, message, error }` body — 400 validation (global `ValidationPipe`, whitelist on), 404 unknown id, 409 state conflict (archived wallet, same-wallet transfer). The Web App shows the message inline next to the form or list that failed; never a silent failure.
- **Auth pattern**: none — single person, no login, privately hosted (A-1). Every endpoint is public to whoever can reach the app.
- **Removal**: Wallets are archived, never deleted. Transactions and Transfers are hard-deleted (A-5).
- **Lists**: transactions list newest `occurredOn` first, ties broken by newest `createdAt`.
- **Layout**: responsive web — usable at phone width (entry happens on the go).

---

## Walking Skeleton Feature

**F-1: Record Income and Expense in a Wallet**

Why this one:
- Touches: React Web App → NestJS Ledger (Controller → Service → Repository) → Postgres via `pg`, with the schema created by Liquibase and the whole stack driven by Playwright.
- Highest user value: recording a transaction and seeing the wallet's balance move is the habit everything else (summaries, categories) depends on.
- Exposes integration risk: retires the money round-trip (BIGINT minor units → `bigint` → JSON string → displayed currency and back from a typed amount), the timezone-free `DATE` round-trip through `pg` (which converts `DATE` to a JS `Date` by default and can shift a day), Vite `/api` proxy → Nest wiring, Liquibase migrations against docker-compose Postgres, and the first Playwright run against the real stack.

---

## Open Questions & Assumptions

> Everything the plan rests on that was not settled outright. An assumption written here is a decision the
> user can still overturn; an assumption left unwritten is a silent bet.

| Ref | Question or assumption | Impact if wrong | Status |
|---|---|---|---|
| A-1 | One person uses the app; there is no login; it is hosted privately (local machine or a private network), not on the public internet. | If others use it or it is public: every entity gains an owner, every query filters by it, and a Sign-in feature becomes the new walking-skeleton prerequisite. Retrofitting after F-1 is a brownfield change behind a FeatBit flag. | Assumed — confirm at review |
| A-2 | One app-wide currency for every Wallet, set in configuration. | Per-wallet currency makes "all wallets" totals meaningless without exchange rates (a true external dependency) — reshapes Summary. | Assumed — confirm at review |
| Q-1 | Money representation: integer minor units in `BIGINT`, positive amount + Kind, JSON as decimal string. | Changing representation after data exists is a migration of every money column. | Open — needs user |
| Q-2 | Are Transfers between Wallets in this epic (F-7)? | Without them, moving cash between wallets must be faked as an expense plus an income, inflating both totals in every summary. | Open — needs user |
| Q-3 | Are Categories in this epic (F-6)? | Without them summaries answer "how much" but not "on what". | Open — needs user |
| A-3 | Summaries cover all Wallets by default and can be filtered to one Wallet. | If only one of the two is wanted, part of F-4 is unused functionality. | Assumed — confirm at review |
| A-4 | A week runs Monday to Sunday. | Every weekly total shifts by a day's worth of transactions. | Assumed — confirm at review |
| Q-4 | Transactions carry a date only, no time of day (AD-1). | If time of day is needed later it cannot be recovered for existing data. | Open — needs user |
| A-5 | Transactions can be edited and hard-deleted; no undo, no change history. | If an audit trail is needed, deletes become soft-deletes and every query filters them. | Assumed — confirm at review |
| A-6 | A Wallet has an Opening Balance that is not Income; a Balance may go negative (cards, overdrafts). | If opening money must be income, the first month's summary is inflated; if negatives must be blocked, expense entry gains a rejection path. | Assumed — confirm at review |
| A-7 | Success metric: one full month recorded and its summary reconciles to the minor unit. | Wrong metric means the conformance gate judges the wrong outcome. | Assumed — confirm at review |
| A-8 | A Period Summary is numeric totals (income, expense, net) with previous/next navigation — no charts. | Charts would add a frontend charting library and design work to F-4/F-5. | Assumed — confirm at review |
| Q-5 | Category Kind: is each Category tied to income or expense, and are any Categories pre-seeded? | Decides whether a Transaction's Category must match its Kind and what F-6's first screen looks like. | Open — round 2, if F-6 stays |
| Q-6 | Summary reads the Ledger's tables directly (read-only SQL) rather than through a Ledger interface. | If Ledger's schema changes, Summary's queries break silently — acceptable inside one service and one database, but it is a data-ownership exception. | Open — round 2 |
