# Epic: Money Management

> Status: **CONFIRMED 2026-10-28 — RECHECK PASS** (drafted 2026-10-28 by plan-epic from the raw idea:
> "i want to need money management web applicationtion that manage income and expense each wallet and
> summary per weekly and monthly"). **Grilling rounds 1–11 answered 2026-10-28 (rounds 5–11 from
> RECHECK findings) — frontier empty; RECHECK passed.** (multi-user with
> in-app email + password, a Currency per Wallet, per-Wallet sharing with family Members, a Converted
> Total in a Home Currency via Frankfurter exchange rates, same-Currency Transfers between owned
> Wallets only, server-side sessions, password rule).

## Goal
Several people each keep their own wallets — each wallet in its own currency, optionally shared with family — record each income and expense against the wallet it went through, transfer money between their wallets, and read how much came in, went out, and was left over for any week or month, with a Converted Total in their home currency when their wallets hold other currencies.

## Business Value
Financial awareness for a family: one place where each User answers "how much do I have in each wallet" and "did I spend more than I earned this week / this month" without a spreadsheet, and where Members record into the Wallets shared with them. Greenfield tool for a few Users — the value is each User's habit of recording, so speed of recording a Transaction and exact Currency Totals matter more than breadth.

## Success Metric
The user records every income and expense for one full calendar month in the app and, at month end, reads that month's income, expense, and net — per Currency and per wallet — on one screen, with those Currency Totals matching their own reconciliation to the minor unit (the "≈" Converted Total is approximate by definition and is not part of the reconciliation).
**Value today**: no tool exists (0 months recorded; summaries are worked out by hand, if at all). _(A-7 — confirmed round 1.)_

## Out of Scope

> What a reader would reasonably assume is included, but isn't. Each line prevents a feature nobody asked for.

- **Budgets / limits / alerts** — the brief asks for recording and summaries, not targets. Candidate for a later epic.
- **Email of any kind** — no email verification, no "forgot password", no emailed invitations (Q-8). A forgotten password is reset by an operator directly in the database.
- **Third-party sign-in** (Google, etc.) — email + password in-app only (Q-7).
- **Transfers between Wallets of different Currencies** — same-Currency only (Q-9). Converting money between Currencies is recorded as an expense in one Wallet and an income in the other.
- **Editing a Wallet's Currency** — fixed at creation (Q-11).
- **Currencies the rate provider does not cover** — Wallet Currencies are limited to Frankfurter's list (Q-22).
- **Family groups** — sharing is per Wallet with individual Users; no Family entity (Q-15).
- **Invitations with acceptance** — a Member is added immediately by email of an existing User (Q-16).
- **Shared Wallets in a Member's Currency Totals, all-wallets summary, or Transfers** — a Member sees a shared Wallet and its one-wallet summary only (Q-19).
- **Bank / e-wallet sync, statement import, CSV import or export** — every transaction is entered by hand.
- **Recurring / scheduled transactions** — each transaction is entered when it happens.
- **Charts and trend graphs** — summaries are numeric Currency Totals with previous/next period navigation (A-8).
- **Receipts, photos, attachments** on transactions.
- **Native mobile app** — a responsive web app only.
- **Investments, loans, debts owed to/by others, interest** — wallets hold a balance; nothing more.
- **Undo / audit history** of edits and deletes (A-5).
- **Personal-data rights (PDPA)** — "delete my data" and "export my data" are the first candidates for a later epic (Q-30).

---

## Features

| ID | Name | Description | Surface | Priority | Effort | Depends On | Status |
|---|---|---|---|---|---|---|---|
| F-1 | Sign Up and Sign In | Sign up with an email and password, sign in, sign out. Every other screen and endpoint requires a signed-in User and shows only data that User may see. | full | High | M | none | Planned |
| F-2 | Record Income and Expense in a Wallet | Create a wallet (name, Currency, opening balance), record an income or expense in it (amount, date, optional note), and see the wallet's balance and its transactions newest-first. | full | High | M | F-1 | Planned |
| F-3 | Wallet Overview and Management | See every wallet with its current balance in its own Currency and a Currency Total of the Balances of the Wallets they own; rename a wallet; archive a wallet so it stops accepting new transactions but keeps its history. | full | High | S | F-2 | Planned |
| F-4 | Share a Wallet | The owner shares a Wallet with a Member by typing the email of an existing User; it appears in the Member's wallet list immediately. A Member can view the Wallet and record Transactions in it (editing and deleting them arrives with Edit and Delete Transactions, F-5); only the owner renames, archives, shares, or removes Members. The owner can remove a Member and a Member can leave; their Transactions stay. Each Transaction in a shared Wallet shows who recorded it. | full | High | M | F-3 | Planned |
| F-5 | Edit and Delete Transactions | Correct a recorded transaction's kind, amount, date, wallet, or note, or delete it after a confirmation; balances reflect the change immediately. The owner and Members of a shared Wallet may both edit and delete its Transactions (Q-33). A Transaction's Wallet may change only to another Wallet of the same Currency that the editor can record into (owned or shared with them) — checked in this order: not visible → 404, different Currency → 400, archived → 409 (Q-34). | full | High | S | F-2, F-4 | Planned |
| F-6 | Monthly Summary | For a selected calendar month, see Income, Expense, and Net as Currency Totals — across all owned wallets (one line per Currency) by default, or filtered to one wallet — and step to the previous/next month. | full | High | M | F-2, F-4 | Planned |
| F-7 | Weekly Summary | The same summary for a selected week (Monday–Sunday), with previous/next week navigation, from the same summary screen as F-6. | full | High | S | F-6 | Planned |
| F-8 | Categorize Transactions | Define income and expense categories, assign one (optionally) to each transaction, and see the selected period's expense and income broken down by Category, per Currency, in the summary. | full | Medium | M | F-2, F-5, F-6 | Planned |
| F-9 | Transfer Between Wallets | Transfer an amount between two wallets of the same Currency as a single transfer; both balances change; a one-wallet summary shows transfers in/out as separate lines; the all-wallets summary leaves transfers out. A Wallet's detail list shows its Transfers among its Transactions, newest first, marked "transfer in" / "transfer out"; Members of a shared Wallet see them read-only (Q-51); the other Wallet's name and id are returned only to a User who can see that Wallet — otherwise the row reads just "transfer in" / "transfer out" (Q-52). The owner can delete a Transfer from that list after a confirmation and both Balances reflect it; no edit — delete and record again (Q-50). | full | Medium | M | F-3, F-6 | Planned |
| F-10 | Home Currency Conversion | Each User sets a Home Currency (at sign-up, changeable in settings). A Converted Total appears in exactly two places (Q-40): the Wallet Overview, converting owned Wallets' Balances at today's Exchange Rate, and the all-wallets Period Summary, converting each Transaction at the rate on its own date; a one-wallet summary never shows one. The summary's Converted Total has three figures — ≈ Income, ≈ Expense, and ≈ Net = ≈ Income − ≈ Expense (Q-46). Amounts already in the Home Currency are counted as they are. It is shown whenever any included Wallet's Currency differs from the Home Currency, and hidden when everything is already in the Home Currency (Q-36); "included" means, on the summary, a Wallet with Income or Expense in the Period, and on the Wallet Overview, an owned Wallet with a non-zero Balance (Q-47). A User with no Home Currency yet sees no Converted Total and a prompt to choose one (Q-41). Converted Totals are marked "≈", shown above the Currency Total lines, rounded half-even to the Home Currency's minor unit. Rates come from Frankfurter and are cached; if a rate is missing, the Currency Total lines show with a notice instead of a Converted Total. Adds rate fetching to the Exchange Rates module that F-2 introduced (Q-35). | full | High | M | F-3, F-6 | Planned |

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
1. F-1:  Sign Up and Sign In                     ← Walking Skeleton — start here (Q-12)
2. F-2:  Record Income and Expense in a Wallet   ← requires F-1
3. F-3:  Wallet Overview and Management          ← requires F-2
4. F-4:  Share a Wallet                          ← requires F-3 (early so every later query is built with the access rule — Q-25)
5. F-5:  Edit and Delete Transactions            ← requires F-2, F-4 (applies the Member access rule — Q-33)
6. F-6:  Monthly Summary                         ← requires F-2, F-4 (one-wallet summary applies the Member access rule)
7. F-7:  Weekly Summary                          ← requires F-6
8. F-8:  Categorize Transactions                 ← requires F-2, F-5, F-6
9. F-9:  Transfer Between Wallets                ← requires F-3, F-6
10. F-10: Home Currency Conversion               ← requires F-3, F-6 (last — adds a Converted Total above existing Currency Totals)
```

---

## Shared Domain Entities

> These entities appear in multiple features. All features must use identical names and field definitions.

| Entity | Canonical Fields | Used In |
|---|---|---|
| User | `id: string` (UUID), `email: string` (unique, case-insensitive), `passwordHash: string` (never leaves Identity), `createdAt: Date`, `updatedAt: Date`, `homeCurrency: string \| null` (ISO-4217, added by F-10; chosen at sign-up, changeable; null only for a User who had no Wallet when F-10 arrived, until they choose — Q-27, Q-41) | F-1 (owner), F-4 (looked up by email; emails shown for "recorded by" — through Identity, Q-39), every other feature (access filter) |
| Wallet | `id: string` (UUID), `userId: string` (the owner), `name: string`, `currency: string` (ISO-4217 code, fixed at creation), `openingBalanceMinor: bigint` (minor units of the Wallet's Currency), `archivedAt: Date \| null` (added by F-3), `createdAt: Date`, `updatedAt: Date` — `balanceMinor: bigint` is **derived on read, never stored** | F-2 (owner), F-3, F-4, F-5, F-6, F-7, F-8, F-9, F-10 |
| Transaction | `id: string` (UUID), `walletId: string`, `kind: 'income' \| 'expense'`, `amountMinor: bigint` (> 0), `occurredOn: string` (calendar date `YYYY-MM-DD`), `note: string \| null`, `categoryId: string \| null` (added by F-8), `recordedByUserId: string` (added by F-4; existing rows backfilled with the Wallet owner), `createdAt: Date`, `updatedAt: Date` | F-2 (owner), F-3 (balances), F-4, F-5, F-6, F-7, F-8, F-10 (converted summary) |
| Period Summary _(computed, not stored)_ | `period: 'week' \| 'month'`, `startsOn: string`, `endsOn: string` (inclusive dates), `walletId: string \| null` (null = all wallets), Currency Totals `incomeMinor`, `expenseMinor`, `netMinor` **per Currency**; one-wallet summary adds `transfersInMinor`, `transfersOutMinor` (F-9); F-8 adds a breakdown per Category, Kind and Currency; F-10 adds a Converted Total in the Home Currency to the all-wallets summary only (Q-40) — `convertedIncomeMinor`, `convertedExpenseMinor`, `convertedNetMinor` (= converted Income − converted Expense, Q-46) | F-6 (owner), F-7, F-8, F-9, F-10 |
| Category | `id: string` (UUID), `userId: string`, `name: string`, `kind: 'income' \| 'expense'`, `createdAt: Date`, `updatedAt: Date` — optional on a Transaction; none pre-loaded; deleting one sets its Transactions' `categoryId` to null. In a shared Wallet a Member picks from their own Categories; everyone sees the name; only its creator renames or deletes it; same-named Categories of different creators are listed separately | F-8 (owner; adds a Category to F-5's edit) |
| Transfer | `id: string` (UUID), `fromWalletId: string`, `toWalletId: string` (same Currency as from), `amountMinor: bigint` (> 0), `occurredOn: string`, `note: string \| null`, `createdAt: Date`, `updatedAt: Date` — both Wallets **owned** by the signed-in User (Q-19) | F-9 (owner; extends F-3's Balance derivation and adds transfer lines to F-6/F-7's one-wallet summary) |
| Wallet Share | `walletId: string`, `userId: string` (the Member), `createdAt: Date` — one row per (Wallet, Member); a single Member role, no per-share permissions | F-4 (owner), F-5, F-6, F-7, F-8, F-9, F-10 |
| Session _(Identity-internal)_ | `id: string` (random token, the cookie value — not a UUID), `userId: string`, `expiresAt: Date` (30-day sliding), `createdAt: Date` | F-1 (owner); read by the guard on every request |
| Sign-in Attempt _(Identity-internal)_ | `email: string` (lower-cased as typed; **no FK to User** — unknown emails are counted too), `attemptedAt: Date` — one row per failed sign-in; no `id` (rows are only counted and deleted, never referenced). The 10th failure within 15 minutes pauses that email for a fixed 15 minutes from that failure (429; attempts refused during the pause are not stored); a successful sign-in deletes that email's rows (Q-32, Q-42) | F-1 (owner) |
| Exchange Rate | `fromCurrency: string`, `toCurrency: string`, `rateOn: string` (the **requested** date — the cache key), `publishedOn: string` (the ECB working day the rate was published; ≤ `rateOn`), `rate: string` (decimal, never float), `fetchedAt: Date` — cached copy of Frankfurter's rate for the latest publication on or before `rateOn` (Q-38); a past date's row never changes | F-10 (owner) |

---

## Domain Language

> The words this epic uses, and the words it refuses. One canonical term per concept — every displaced
> word goes under `_Avoid_` so a reviewer can grep for it. Definitions say what a thing IS, never how it
> works. **Terms confirmed by the user in round 1; User and Currency confirmed in round 2 (Q-13).**
> Shared Wallet, Member, Home Currency, Exchange Rate, Converted Total confirmed in round 4 (Q-26).
> Currency Total added in round 5 (recheck) to resolve the "total" clash; confirmed round 6 (Q-43).
> Kind written out as a term in round 7 (A-19) — it was already used throughout.

**User**:
A person who signs in to the app and owns Wallets and Categories. Sees and changes only their own data and Wallets shared with them.
_Avoid_: account, customer, profile

**Shared Wallet**:
A Wallet its owner has opened to one or more Members. Still has exactly one owner.
_Avoid_: joint wallet, family wallet, group wallet

**Member**:
A User a Wallet is shared with. Can view it and record its Transactions (and edit and delete them, from F-5); cannot rename, archive, or share it.
_Avoid_: guest, collaborator, participant, family member (as a role name)

**Home Currency**:
The one Currency a User reads Converted Totals in. Chosen at sign-up; changeable. Unset only for a User who had no Wallet when it was introduced, until they choose one.
_Avoid_: base currency, default currency, main currency

**Exchange Rate**:
How many units of one Currency equal one unit of another on a given date, as published by the rate provider.
_Avoid_: FX, conversion rate, forex

**Converted Total**:
A sum, in the Home Currency, of amounts in several Currencies: amounts in another Currency counted at Exchange Rates, amounts already in the Home Currency counted as they are. Exists only when at least one amount is in another Currency. Always approximate (shown with "≈"), never stored.
_Avoid_: grand total, combined balance, total in home currency

**Currency Total**:
The exact sum of amounts that share one Currency — one line per Currency in the Wallet Overview and in a Period Summary. Never mixes Currencies.
_Avoid_: total (as a bare word), subtotal, currency sum

**Currency**:
The ISO-4217 money unit a Wallet holds (e.g. THB, USD, JPY). Fixed when the Wallet is created; decides how many minor-unit digits its amounts have.
_Avoid_: money type, denomination

**Wallet**:
A named place where a User's money sits — cash, money at a bank, an e-wallet, a card — holding one Currency. Every Transaction belongs to exactly one Wallet.
_Avoid_: account, pocket, fund, source

**Balance**:
How much money a Wallet holds right now: its Opening Balance plus its income, minus its expense, plus Transfers in, minus Transfers out. May be negative.
_Avoid_: total (as a bare word), amount (meaning a Balance), remaining

**Opening Balance**:
The money already in a Wallet on the day the person starts tracking it. It is not income.
_Avoid_: initial deposit, starting income, seed amount

**Transaction**:
One recorded flow of money into or out of a single Wallet, of Kind income or expense, on a calendar date.
_Avoid_: entry, record (as a noun), item, movement, payment, ledger line

**Kind**:
Whether a Transaction is Income or Expense — whether its money comes into or goes out of the Wallet. A Category also has one Kind.
_Avoid_: type, direction, sign

**Income**:
A Transaction Kind: money received into a Wallet.
_Avoid_: revenue, earning, credit, deposit

**Expense**:
A Transaction Kind: money spent out of a Wallet.
_Avoid_: spending, cost, debit, outflow, withdrawal

**Transfer**:
An amount a User sends from one Wallet they own to another Wallet they own, in the same Currency. It changes both Balances and is neither Income nor Expense.
_Avoid_: move, internal transaction, top-up

**Category**:
A User-defined name for what a Transaction was for (e.g. Food, Salary), belonging to one Kind and to the User who created it.
_Avoid_: tag, label, type, group

**Period**:
A calendar week (Monday to Sunday) or a calendar month, identified by its first and last date.
_Avoid_: range, interval, cycle, timeframe

**Period Summary**:
The Income, Expense, and Net of a Period as Currency Totals, for all Wallets the User owns or for one Wallet they can see.
_Avoid_: report, statement, dashboard, overview (except inside the screen name "Wallet Overview" — F-3's list of Wallets with Balances, which is not a Period Summary)

**Net**:
Income minus Expense within a Period. Not the same as a Balance.
_Avoid_: profit, savings, cash flow, total (as a bare word)

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
| **Web App** (React SPA, `frontend/`) | Screens for wallets, transactions, summaries. Holds no money rules: formats minor units for display, and converts what the person typed (e.g. "125.50") into a minor-unit string ("12550") using the Wallet's Currency digits (ISO-4217) before sending; the backend validates it as a positive integer string. Talks to the backend only through its injected API services. | Frontend service interfaces (`ServiceContext`) — production adapter calls `/api/v1` over HTTP; test adapter is `createMockServices()`. Mandated layer interface. | In-process (UI) over Remote but owned (the backend API, mocked by Mountebank only in Stage 7 / Stage 21 mock runs) | F-1 … F-10 |
| **Identity** (Nest module `identity`, `backend/src/identity/`) — _added round 1 (A-1); email + password in-app (Q-7)_ | Owns Users, Sessions, and Sign-in Attempts. Hides password hashing, session issue/verification (session in an httpOnly cookie), and the sign-in throttle. Exposes to other modules only (a) "who is the signed-in User": a guard that yields `{ userId, homeCurrency }` (homeCurrency from F-10, null until chosen), and (b) two in-process lookups used by Ledger from F-4 (Q-39): find a User by email → `userId` or none, and emails for a list of `userId`s (for "recorded by" and the Member list). No other module reads `users`. From F-10, sign-up carries `homeCurrency` and `PATCH /api/v1/me` changes it; both ask Exchange Rates whether the Currency is supported, as Ledger does (Q-35). Errors: 400 validation (incl. password rule, unsupported Home Currency), 401 not signed in / wrong credentials, 409 email taken, 429 too many failed sign-ins. | Controller → Service → Repository (mandated). Repository adapter: `pg`. | Service: In-process · Repository: Local-substitutable | every feature |
| **Ledger** (Nest module `ledger`, `backend/src/ledger/`) | Owns Wallets, Wallet Shares, Transactions, Categories, Transfers, and Balances. Invariants: every read and write is scoped to the Wallets the signed-in User owns or is a Member of (F-4) — any other id answers 404, never 403 (no existence leak); owner-only actions (rename, archive, share, remove Member) by a Member answer 403; a Transfer's two Wallets are both owned by the signed-in User (403 if one is only shared); a Transfer's two Wallets differ (400) and share one Currency (400); Wallet checks run in this order so a 400 never reveals an invisible Wallet: request shape (same id, amount, date) 400 → not visible 404 → not owned 403 → different Currency 400 → archived 409; a Transaction's or Transfer's `occurredOn` later than the browser's `today` (sent on every such write) is a 400 (Q-45, Q-48); amounts are positive integers in minor units of the Wallet's Currency; Kind decides direction; a Balance is always derived, never stored; an Archived Wallet accepts no new Transaction or Transfer (409); an edit that changes a Transaction's Wallet accepts only a Wallet the editor can see (404), of the same Currency (400), not archived (409), checked in that order (Q-34); a Transaction's Category has the same Kind (400); a new Wallet's Currency must be on the supported-Currency list, asked of Exchange Rates (400, Q-35). From F-4, adding a Member and showing "recorded by" go through Identity's lookups (Q-39). From F-10, `GET /wallets` also returns the Wallet Overview's Converted Total, asking Exchange Rates for the rate on the `today` date the Web App sends (AD-3, Q-37). Errors: 400 validation, 401 not signed in, 403 owner-only action, 404 unknown id, 409 state conflict. | Controller → Service → Repository (mandated layer interfaces). Repository adapter: `pg` against Postgres; unit-test adapter: `jest.Mocked<I…Repository>`. | Service: In-process · Repository: Local-substitutable | F-2, F-3, F-4, F-5, F-8, F-9, F-10 |
| **Summary** (Nest module `summary`, `backend/src/summary/`) | Read-only, scoped to the signed-in User: the all-wallets summary covers Wallets they **own**; a one-wallet summary works for any Wallet they own or are a Member of (Q-19). Given a Period (week or month containing a date) and an optional Wallet, returns a Period Summary — one Currency Total line per Currency, plus (from F-10, all-wallets summary only — Q-40) a Converted Total in the User's Home Currency (taken from Identity's guard) through the Exchange Rates module whenever any included Wallet's Currency differs from it (Q-36) — (and, from F-8, a breakdown per Category, Kind and Currency — never mixing Currencies). Summary requests carry no `today` — each Transaction converts at its own date's rate (AD-3, Q-49). The Converted Total has three figures, ≈ Income, ≈ Expense, ≈ Net (Q-46), and appears only when a Wallet in another Currency had Income or Expense in the Period (Q-47). Hides Period boundary arithmetic (Monday week start, month lengths) and the aggregation queries. Transfers never count as Income or Expense. Archived Wallets still count. Never writes. | Controller → Service → Repository (mandated). Repository adapter: read-only `pg` aggregation over the Ledger's tables (Q-6); unit-test adapter: mocked repository. | Service: In-process · Repository: Local-substitutable | F-6, F-7, F-8, F-9, F-10 |
| **Exchange Rates** (Nest module `rates`, `backend/src/rates/`) — _added round 2 (Q-10); Frankfurter (Q-22); introduced by F-2 with the Currency list only (Q-35)_ | **From F-2:** answers whether a Currency is supported, from a fixed snapshot of Frankfurter's currency list kept in the module (no Gateway, no live call); asked by Ledger (Wallet Currency) and, from F-10, by Identity (Home Currency). **From F-10:** given a Currency pair and a date, returns a decimal rate or "unavailable" — never throws to the caller for a provider outage. Frankfurter publishes only on ECB working days, so a date's rate is the latest one published on or before it (Saturday → Friday) (Q-38). Hides which provider is used and the rate cache in Postgres, keyed by the **requested** date (`rateOn`) with the actual `publishedOn` stored beside it; a fetched rate is cached forever only when it was published for exactly the requested date (`publishedOn = rateOn`) or the requested date is more than one day before the server's date (Postgres `now()`); otherwise it is used once and not stored, because that day's rate may not be published yet. Callers pass only a Currency pair and a date; for the Wallet Overview, Ledger passes the browser's `today` as that date. No caller-supplied date ever decides caching (Q-44). | Service → Repository (rate cache, `pg`) + **Gateway** (HTTP to Frankfurter, no API key; from F-10). Gateway adapters: real provider in production, **Mountebank impostor** in every test. | Service: In-process · Repository: Local-substitutable · Gateway: **True external** | F-2, F-10 (Ledger, Summary, and Identity call it) |
| **Postgres** (PostgreSQL 16, schema via Liquibase) | The single store. Identity owns `users`, `sessions`, and `sign_in_attempts`; Ledger owns `wallets`, `wallet_shares`, `transactions`, `categories`, `transfers`; Exchange Rates owns `exchange_rates`; Summary only reads Ledger's tables (never `users` — the Home Currency comes from Identity's guard); Ledger reaches `users` only through Identity's lookups (Q-39). | `PG_POOL` injected by a global `DatabaseModule`. Real via `docker-compose.backing-service.yml` in integration tests. | Local-substitutable | all |

**Dependency categories** (each fixes the test strategy — see `.claude/guidelines/deep-modules.md`):
In-process · Local-substitutable (kept real, via `docker-compose.backing-service.yml`) · Remote but owned (Mountebank impostor) · True external (Mountebank impostor).
**One True external dependency**: the exchange-rate provider (F-10), always behind a Mountebank impostor in tests. Mountebank also stands in for this project's own `/api/v1` during Stage 7 / Stage 21 mock runs.

**Acceptance seam**: the browser — Playwright drives the Web App, which calls the real NestJS `/api/v1` backed by real Postgres (Stage 25). The Bruno suite drives `/api/v1` directly for the backend contract.

**Deliberately not a seam**:
- **Period calendar** (week/month boundary computation) — pure functions inside Summary; one implementation, tested through Summary's interface.
- **Clock / "today"** — two different clocks, neither a port (Q-37). The **calendar "today"** is always the browser's local date: the Web App pre-fills a new Transaction's date with it (A-13) and sends it as `today` with every Transaction create and edit and every Transfer create, so Ledger can reject a date after it (Q-45, Q-48), and with every Wallet Overview request, to pick today's Exchange Rate (AD-3, A-18). Summary requests carry no `today` (Q-49). Whether a rate may be cached is decided by server time, never by the browser (Q-44). **Server time** — session expiry, the sign-in pause, the rate-cache rule, audit timestamps — is Postgres `now()` inside the queries that need it. Tests control time through the request's date and through rows' timestamps, not through an injected clock.
- **A separate Wallets module or Categories module** — wallets, transactions, categories, and transfers share invariants (archive rule, kind matching, balance derivation); splitting them would scatter those rules across modules (deletion test). Stage 11 may still split files inside `ledger/`.
- ~~Auth guard~~ — overturned in round 1: A-1 is now multi-user, so Identity is a real module (above).
- **A separate Sharing module** — who may see a Wallet is a Ledger invariant checked on every Ledger read and write; splitting it out would put the access rule on the far side of a seam from every query that needs it.
- **Rate-provider interface with several adapters** — the Gateway seam exists because the provider is True external (Mountebank in tests), not to support swapping providers; a second provider would be a later change behind the same Exchange Rates interface.

---

## Architecture Decisions

> Only decisions that are **hard to reverse**, **surprising without context**, and **the result of a real
> trade-off**. All three, or leave it out — most epics record zero. A decision needing evidence first goes
> to `/project:develop-research` instead.

### AD-1 — A Transaction carries a calendar date, not a timestamp
Weekly and monthly summaries bucket by the day the person says the money came in or went out; storing a timezone-less `DATE` (`occurredOn`) makes that bucketing exact regardless of server or browser timezone, at the cost of never knowing the time of day. A UTC timestamp was rejected because a late-evening expense would land in the next day — and sometimes the next week or month — depending on whose timezone computes the summary, and the time of day cannot be recovered later. _(Confirmed by the user, round 1 — Q-4.)_

### AD-2 — Each Wallet holds its own Currency, fixed at creation
A User may keep Wallets in different Currencies (e.g. THB money at a bank and a USD card). The Currency lives on the Wallet, not the Transaction, so every amount in a Wallet shares one Currency and a Balance is always a single number. Rejected: one app-wide Currency (the user needs real multi-currency wallets) and a Currency per Transaction (a Balance would become a list of amounts). Consequence: amounts of different Currencies are never summed natively — cross-Wallet sums are Currency Totals, and the Converted Total (F-10, Q-10) is a derived view at an Exchange Rate, never stored. _(Confirmed by the user, round 1 — A-2; conversion added round 2 — Q-10.)_

### AD-3 — Converted Totals use the rate on each Transaction's date; Balances use today's rate
A past Period's Converted Total is computed with each Transaction's own-date Exchange Rate, so last month's Converted Total never changes; the Wallet Overview's Converted Total uses today's rate (today = the browser's local date, Q-37) because a Balance is a "now" figure. Rejected: one rate (today's) for everything — past summaries would drift every day. Consequence: the provider must serve historical daily rates (Frankfurter does). Frankfurter publishes only on ECB working days, so a date's rate is the latest published on or before it (Saturday → Friday); the cache is keyed by the requested date, stores the publication date beside it, and caches a rate only once it can no longer change, judged by server time (Q-38, Q-44). _(Confirmed by the user, round 3 — Q-21; publication-day rule round 5 — Q-38.)_

---

## Project Conventions

> All features must follow these without exception.

- **Identity key**: every entity has `id: string`, a UUID generated server-side by Postgres (`gen_random_uuid()`); references are `{entity}Id: string` (`walletId`, `categoryId`, `fromWalletId`, `toWalletId`). Exceptions, by design: **Session** `id` is a random token (the cookie value), not a UUID; **Wallet Share** has no `id` — its key is (`walletId`, `userId`); **Exchange Rate** has no `id` — its key is (`fromCurrency`, `toCurrency`, `rateOn`); **Sign-in Attempt** has no `id` and no key — its rows are only counted and deleted by `email`.
- **Money**: integer minor units only — `BIGINT` columns named `*_minor`, `bigint` in backend TypeScript, and a **decimal-integer string** in JSON (`"amountMinor": "12550"`) because JSON numbers cannot carry `bigint`. Never floating point. Amounts on Transactions and Transfers are always > 0; direction comes from Kind (or from/to). Each amount is in minor units of its **Wallet's Currency** (AD-2); the number of minor-unit digits comes from ISO-4217 (THB/USD 2, JPY 0, BHD 3) — never assume 2. The Web App formats with `Intl.NumberFormat` for the Wallet's Currency. Amounts of different Currencies are never added together. _(Q-1 confirmed round 1.)_
- **Balance**: derived on read from Opening Balance, Transactions, and Transfers; never stored, never cached.
- **Dates**: `occurredOn` is a `DATE` / `YYYY-MM-DD` string with no time and no timezone (AD-1). Audit fields `createdAt` / `updatedAt` are `TIMESTAMPTZ`, ISO-8601 UTC in JSON. A week is Monday–Sunday (A-4).
- **API shape**: REST under `/api/v1`, plural resource nouns, camelCase JSON; database tables and columns snake_case, plural table names (`users`, `sessions`, `sign_in_attempts`, `wallets`, `wallet_shares`, `transactions`, `categories`, `transfers`, `exchange_rates`).
- **Error handling**: Nest `HttpException`s in the default `{ statusCode, message, error }` body — 400 validation (global `ValidationPipe`, whitelist on; includes same-wallet or different-Currency Transfer, unsupported Currency, changing a Transaction's Wallet to one of another Currency, a future `occurredOn`), 401 not signed in or wrong credentials, 403 a Member attempting an owner-only action or a Transfer touching a Wallet the User does not own, 404 unknown or not-visible id, 409 state conflict (archived wallet, email taken, already a Member), 429 too many failed sign-ins. Where several apply, visibility (404) is checked before any rule that needs the Wallet's data (Currency 400, owner 403, archived 409), so no error reveals an invisible Wallet. The Web App shows the message inline next to the form or list that failed; never a silent failure.
- **Auth pattern**: email + password; a password is at least 8 characters with at least one letter (any case), one number, and one symbol (Q-29) — validated on the backend (400) and shown inline on the sign-up form; passwords stored only as a slow hash (argon2id or bcrypt — Stage 8 picks); the 10th failed sign-in for one email within 15 minutes pauses sign-in for that email for a fixed 15 minutes from that failure (429, the message says when to try again); attempts refused during the pause are not stored; failed attempts are stored by the lower-cased typed email and a successful sign-in clears them (Q-32, Q-42). Sessions are rows in Postgres (`sessions`, owned by Identity), 30-day sliding expiry, deleted on sign-out; the cookie carries only a random session id (httpOnly, SameSite=Lax, Secure outside local dev). Every `/api/v1` endpoint except sign-up / sign-in requires a signed-in User (401 otherwise); every query filters to data the signed-in User may see; any other id answers 404 (A-1, Q-7).
- **Today**: the Web App pre-fills a new Transaction's date with the browser's local date; editable, but never later than that date — a future date is a 400 shown inline as "date can't be in the future" (A-13, Q-45). The same browser date is sent as `today` with every Transaction create and edit and every Transfer create (from F-2 / F-5 / F-9, to reject a future `occurredOn` — Q-45, Q-48) and with every Wallet Overview request (from F-10, to pick today's Exchange Rate — Q-37, A-18). Summary requests carry no `today` (Q-49). Server-side time (session expiry, throttle pause, the rate-cache rule — Q-44) is Postgres `now()`.
- **Archived Wallets**: hidden from wallet pickers for new Transactions and Transfers; still counted in every past Period Summary and in Currency Totals.
- **Access**: a Wallet is visible to its owner and its Members. Unknown or invisible ids → 404; a Member attempting an owner-only action → 403. "All wallets" (the Wallet Overview's Currency Totals and Converted Total, the all-wallets summary) means Wallets the User **owns**.
- **Converted amounts**: computed with decimal arithmetic (never float), rounded half-even to the Home Currency's minor unit, labelled "≈", never stored. Shown only on the Wallet Overview and the all-wallets Period Summary (Q-40) — on the summary as ≈ Income, ≈ Expense, ≈ Net (Q-46) — only when some included Wallet's Currency differs from the Home Currency (Q-36; "included" per Q-47), and only once the User has a Home Currency — otherwise a prompt to choose one (Q-41). Amounts already in the Home Currency are counted as they are. A missing rate shows the Currency Total lines plus a notice naming the Currency and date — never a partial or wrong Converted Total.
- **Removal**: Wallets are archived, never deleted. Transactions and Transfers are hard-deleted (A-5, Q-50); Transfers cannot be edited.
- **Lists**: a Wallet's detail list holds its Transactions and (from F-9) its Transfers, marked "transfer in" / "transfer out", newest `occurredOn` first, ties broken by newest `createdAt` (Q-51). A Transfer row names its other Wallet (name and id) only for a User who can see that Wallet (Q-52).
- **Layout**: responsive web — usable at phone width (Transactions are recorded on the go).

---

## Walking Skeleton Feature

**F-1: Sign Up and Sign In** _(chosen round 2, Q-12)_

Why this one:
- Touches: React Web App → NestJS Identity (Controller → Service → Repository) → Postgres via `pg`, with the schema created by Liquibase and the whole stack driven by Playwright.
- Every later feature is scoped to a signed-in User, so ownership is built into the first table instead of retrofitted behind a FeatBit flag.
- Exposes integration risk: retires the session cookie across the Vite `/api` proxy → Nest (httpOnly, SameSite), the auth guard that every later endpoint relies on, Liquibase migrations against docker-compose Postgres, and the first Playwright run against the real stack (including a signed-in fixture every later E2E spec reuses).
- **F-2** then retires the money round-trip (BIGINT minor units of a Wallet's Currency → `bigint` → JSON string → `Intl.NumberFormat`) and the timezone-free `DATE` round-trip through `pg` (which converts `DATE` to a JS `Date` by default and can shift a day).

---

## Open Questions & Assumptions

> Everything the plan rests on that was not settled outright. An assumption written here is a decision the
> user can still overturn; an assumption left unwritten is a silent bet.

| Ref | Question or assumption | Impact if wrong | Status |
|---|---|---|---|
| A-1 | Several Users, each with their own Wallets; every record is owned and every query filters by the signed-in User. | — | **Confirmed round 1** |
| A-2 | Each Wallet has its own Currency (AD-2). | — | **Confirmed round 1** |
| Q-1 | Money representation: integer minor units in `BIGINT`, positive amount + Kind, JSON as decimal string. | — | **Confirmed round 1** |
| Q-2 | Transfers between Wallets are in this epic (F-9). | — | **Confirmed round 1** |
| Q-3 | Categories are in this epic (F-8). | — | **Confirmed round 1** |
| A-3 | Summaries cover all Wallets by default and can be filtered to one Wallet. | — | **Confirmed round 1** |
| A-4 | A week runs Monday to Sunday. | — | **Confirmed round 1** |
| Q-4 | Transactions carry a date only, no time of day (AD-1). | — | **Confirmed round 1** |
| A-5 | Transactions can be edited and hard-deleted after a confirmation; no undo, no change history. | — | **Confirmed round 1** |
| A-6 | A Wallet has an Opening Balance that is not Income; a Balance may go negative. | — | **Confirmed round 1** |
| A-7 | Success metric: one full month recorded and its summary reconciles to the minor unit. | — | **Confirmed round 1** |
| A-8 | A Period Summary is numeric Currency Totals (income, expense, net) with previous/next navigation — no charts. | — | **Confirmed round 1** |
| A-9 | Wallets are archived, never deleted. | — | **Confirmed round 1** |
| A-10 | Responsive web app usable at phone width; no native app. | — | **Confirmed round 1** |
| Q-7 | Sign-in is email + password inside the app. | — | **Confirmed round 2** |
| Q-8 | Open self sign-up; no email verification, no "forgot password"; an operator resets passwords by hand. | — | **Confirmed round 2** |
| Q-9 | Transfers only between Wallets of the same Currency. | — | **Confirmed round 2** |
| Q-10 | Sums across Currencies are shown as a Converted Total in one Home Currency using live Exchange Rates (F-10). | Adds a True external dependency. | **Confirmed round 2** |
| Q-11 | A Currency from the rate provider's supported list (narrowed by Q-22), chosen at Wallet creation, never changeable; defaults to the Currency of the User's last-created Wallet. | — | **Confirmed round 2, narrowed round 3** |
| Q-12 | Sign Up and Sign In is F-1, the walking skeleton. | — | **Confirmed round 2** |
| Q-13 | Terms User and Currency accepted; "account" stays banned. | — | **Confirmed round 2** |
| Q-14 | A User may share chosen Wallets with family (F-4). | Sharing needs access rules on every Wallet read and write. | **Confirmed round 2** — details Q-15 – Q-19 |
| Q-5 | Categories: each belongs to income or expense, per User, optional on a Transaction ("Uncategorized"), none pre-loaded; deleting one leaves its Transactions uncategorized. | — | **Confirmed round 2** |
| Q-6 | Summary reads the Ledger's tables directly (read-only SQL) — accepted data-ownership exception inside one service and one database. | If Ledger's schema changes, Summary's queries must change with it. | **Confirmed round 2** |
| A-11 | One-wallet summary shows transfers in / out as separate lines; all-wallets summary leaves transfers out. | — | **Confirmed round 2**, still valid after Q-19 (transfers only between owned Wallets) |
| A-12 | Archived Wallets count in past summaries and Currency Totals; hidden from pickers for new Transactions and Transfers. | — | **Confirmed round 2** |
| A-13 | A new Transaction's date defaults to the browser's local today, editable. | — | **Confirmed round 2** |
| Q-15 | Sharing is per Wallet with individual Users; no Family group. | — | **Confirmed round 3** |
| Q-16 | Owner adds a Member by the email of an existing User; immediate, no accept step; unknown email → "no user with that email". | Reveals whether an email is registered to any signed-in User (accepted for a family app). | **Confirmed round 3** |
| Q-17 | Members view and record/edit/delete Transactions; only the owner renames, archives, shares, removes Members. Edit/delete for Members lands with F-5 (Q-33). | — | **Confirmed round 3** |
| Q-18 | Each Transaction shows who recorded it (`recordedByUserId`). | — | **Confirmed round 3** |
| Q-19 | A Member's Currency Totals and all-wallets summary cover only Wallets they own; shared Wallets are summarised one at a time; Transfers only between owned Wallets. | — | **Confirmed round 3** |
| Q-20 | Home Currency chosen at sign-up, changeable in settings. | — | **Confirmed round 3** |
| Q-21 | Summaries convert each Transaction at its own date's rate; the Wallet Overview's Converted Total uses today's rate (AD-3). | — | **Confirmed round 3** |
| Q-22 | Frankfurter (ECB data, free, no key, historical); Wallet Currencies limited to its supported list, held as a fixed snapshot in the Exchange Rates module from F-2 (Q-35). Exact list verified at F-2 Stage 1. | If Frankfurter's list lacks a Currency the user needs, that Currency cannot be a Wallet Currency. | **Confirmed round 3** |
| Q-23 | Rates cached in Postgres; a missing rate shows per-Currency lines plus a notice; never a wrong Converted Total, never blocks the page. | — | **Confirmed round 3** |
| Q-24 | Converted Total marked "≈" above per-Currency lines; half-even rounding to the Home Currency minor unit. | — | **Confirmed round 3** |
| Q-25 | Share a Wallet is F-4 (right after Wallet Overview); Home Currency Conversion stays last (F-10). | — | **Confirmed round 3** |
| A-14 | Members pick from their own Categories in a shared Wallet; names visible to all; only the creator renames/deletes. | — | **Confirmed round 3** |
| A-15 | Removing a Member or a Member leaving keeps the Transactions they recorded. | — | **Confirmed round 3** |
| A-16 | No FeatBit flags in this epic: greenfield, and the user uses it alone until the epic is done. | If a feature ships to real users before the next one lands, later changes to existing screens become brownfield and need a flag. | **Confirmed round 4** |
| Q-26 | Terms Shared Wallet, Member, Home Currency, Exchange Rate, Converted Total accepted. | — | **Confirmed round 4** |
| Q-27 | Users who signed up before F-10 get the Currency of their first Wallet as Home Currency (changeable); a User with no Wallet then stays unset until they choose (Q-41); from F-10 the sign-up form asks for it. | — | **Confirmed round 4** |
| Q-28 | Sessions stored server-side in Postgres (revocable); 30-day sliding lifetime; sign-out deletes the session. | — | **Confirmed round 4** |
| Q-29 | Password: at least 8 characters with at least one letter (any case), one number, and one symbol. Sign-in paused 15 minutes after 10 failed attempts for the same email within 15 minutes (429); a fixed pause, refined by Q-42. | — | **Confirmed round 4** |
| Q-30 | No deadline; hosting decided at the deployment track; PDPA features (delete my data, export) are the first candidate for a later epic. | If the app opens to people outside the family, "Delete my data" becomes required. | **Confirmed round 4** |
| Q-31 | Definition of done: the two-User demo in "Definition of Done" below. | — | **Confirmed round 4** |
| Q-32 | Failed sign-in attempts are stored by the lower-cased typed email (`sign_in_attempts`: email, attemptedAt; no FK to User), owned by Identity; a successful sign-in clears that email's earlier failed attempts. | — | **Confirmed round 5 (recheck)** |
| Q-33 | Share a Wallet (F-4) grants Members view + record; Members' edit/delete arrives with Edit and Delete Transactions (F-5), which depends on F-2 and F-4 and applies the Member access rule. | — | **Confirmed round 5 (recheck)** |
| Q-34 | Editing a Transaction may change its Wallet only to a Wallet of the same Currency that the editor can record into (owned or shared with them): not visible → 404, then different Currency → 400, then archived → 409. | — | **Confirmed round 5 (recheck)** |
| Q-35 | F-2 introduces the Exchange Rates module with only the supported-Currency list (fixed snapshot of Frankfurter's currencies, no Gateway, no live calls); F-10 adds rate fetching behind the same module. | If Frankfurter adds or drops a Currency, the snapshot must be updated by hand. | **Confirmed round 5 (recheck)** |
| Q-36 | The "≈" Converted Total shows whenever any included Wallet's Currency differs from the Home Currency (even if all Wallets share one Currency); hidden when everything is already in the Home Currency. "Included" is defined by Q-47. | — | **Confirmed round 5 (recheck)** |
| Q-37 | "Today" for today's Exchange Rate is the browser's local date sent by the Web App (as A-13); server-side time for session expiry and the throttle is Postgres `now()`; no clock port. | — | **Confirmed round 5 (recheck)** |
| Q-38 | Frankfurter publishes only on ECB working days: a date's rate is the latest published on or before it (Saturday → Friday). The cache is keyed by the requested date (`rateOn`) with `publishedOn` stored beside it; caching rule refined by Q-44. | — | **Confirmed round 5, refined round 7 (Q-44)** |
| A-17 | Identity's guard yields `{ userId, homeCurrency }`, so Summary never reads `users` (no second data-ownership exception beyond Q-6); Ledger's `GET /wallets` computes the Wallet Overview's Converted Total by calling Exchange Rates. | — | **Confirmed round 5 (recheck)** |
| Q-39 | Identity offers two in-process lookups — find a User by email, and emails for a list of User ids — used by Ledger for adding Members and showing "recorded by"; no module other than Identity reads `users`. | — | **Confirmed round 6 (recheck)** |
| Q-40 | A Converted Total appears only on the Wallet Overview and the all-wallets Period Summary; a one-wallet summary never shows one (it has one Currency). | — | **Confirmed round 6 (recheck)** |
| Q-41 | A User with no Wallet when F-10 arrives has no Home Currency until they choose one; meanwhile no Converted Total is shown and a prompt asks them to pick. | — | **Confirmed round 6 (recheck)** |
| Q-42 | Sign-in throttle is a fixed pause: the 10th failure within 15 minutes locks that email for 15 minutes from that failure; the message says when to try again; attempts during the pause are refused and not stored. | — | **Confirmed round 6 (recheck)** |
| Q-43 | Term Currency Total accepted. | — | **Confirmed round 6 (recheck)** |
| A-18 | The Web App sends the browser's `today` with every Wallet Overview request to pick today's Exchange Rate (caching is Q-44); writes carry it too (Q-48); summaries do not (Q-49). A Converted Total counts Home-Currency amounts as they are. | — | **Confirmed round 7 (recheck)** |
| Q-44 | A fetched rate is cached only when `publishedOn = rateOn` or `rateOn` is more than one day before the server's date; the browser's `today` never decides caching. | — | **Confirmed round 7 (recheck)** |
| Q-45 | A Transaction's (and, per Q-48, a Transfer's) `occurredOn` may not be later than the browser's `today` (400, "date can't be in the future"). | — | **Confirmed round 7 (recheck)** |
| Q-46 | The all-wallets summary's Converted Total has three figures: ≈ Income, ≈ Expense, ≈ Net = ≈ Income − ≈ Expense (each rounded half-even first). | — | **Confirmed round 7 (recheck)** |
| Q-47 | "Included Wallet" for the Converted Total: on a summary, a Wallet with Income or Expense in the Period; on the Wallet Overview, an owned Wallet with a non-zero Balance. | — | **Confirmed round 7 (recheck)** |
| Q-48 | The no-future-date rule (Q-45) applies to Transfers too; the Web App sends `today` with every Transaction create and edit and every Transfer create. | — | **Confirmed round 8 (recheck)** |
| Q-49 | Summary requests carry no `today`; Exchange Rates is called with only a Currency pair and a date. | — | **Confirmed round 8 (recheck)** |
| Q-50 | The owner may delete a Transfer after a confirmation (F-9); both Balances reflect it. Transfers are never edited — delete and record again. | — | **Confirmed round 9 (recheck)** |
| Q-51 | A Wallet's detail list shows its Transfers among its Transactions, newest first, marked "transfer in" / "transfer out"; Members see them read-only; only the owner can delete one. | — | **Confirmed round 10 (recheck)** |
| Q-52 | A Transfer row shows its other Wallet's name and id only to a User who can see that Wallet; a Member otherwise sees just "transfer in" / "transfer out" and the id is not returned. A Member deleting a visible Transfer gets 403; an invisible one 404. | — | **Confirmed round 11 (recheck)** |
| A-19 | Mechanical fixes from the round 7 recheck: Category breakdown per Currency; 404-before-400 check order; the Web App converts typed amounts to minor units; `PATCH /api/v1/me` for Home Currency with the supported-Currency check; the Kind term. | — | **Confirmed round 7 (recheck)** |

## Definition of Done (epic demo)
Two Users sign up, each choosing THB as Home Currency. User A creates two THB Wallets and one USD
Wallet, and shares the first THB Wallet with User B. B records an expense in it, and it shows
"recorded by B". A records an income and an expense in the USD Wallet. A transfers between the two THB Wallets, adds Categories, and opens the monthly and
weekly Period Summaries: Currency Totals match the Transactions to the minor unit, Transfers are kept
out of Income and Expense, and an "≈" Converted Total in THB appears on the all-wallets summary and
the Wallet Overview.
