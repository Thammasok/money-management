---
name: project-money-management-epic
description: Money-management epic shape after 4 grilling rounds (2026-10-28) — multi-user, Currency per Wallet, sharing, Frankfurter conversion; modules, naming, recurring recheck pitfalls
metadata:
  type: project
---

Epic drafted 2026-10-28 from a one-line idea (wallets, income/expense, weekly + monthly summary), then reshaped heavily in four grilling rounds. Stack: NestJS + React/Vite + Postgres (raw `pg`). Always verify against current `epic.md` — it is the source of truth.

Post-grilling shape (the user expanded scope far beyond the one-line brief):
- Multi-user: email+password, server-side Postgres sessions (30-day sliding), password rule, 429 sign-in throttle. F-1 Sign Up and Sign In is the walking skeleton.
- Currency per Wallet, fixed at creation (AD-2); amounts never summed across Currencies natively.
- Per-Wallet sharing with Members (F-4, deliberately early so every later query carries the access rule); 404 for invisible, 403 for owner-only actions; "all wallets" = owned only.
- Same-Currency Transfers between owned Wallets only (F-9).
- Home Currency Conversion via Frankfurter (F-10, last): per-Transaction-date rates for summaries, today's rate for balances (AD-3); rates cached in Postgres.
- Backend modules: Identity, Ledger, Summary (reads Ledger tables directly — accepted exception Q-6), Exchange Rates (Gateway = only True external). Splitting Ledger / a Sharing module rejected by the deletion test.
- Money = BIGINT minor units of the Wallet's Currency, JSON decimal strings; `occurredOn` DATE (AD-1).

Recurring pitfalls seen at RECHECK (watch for them on extensions):
- Grilling-round question numbers (Q14, Q24, Q38…) got cited inline where the Q-n register uses different numbers — cite only Q-n/A-n register IDs.
- Features renumbered twice; feature descriptions granting capabilities a later feature builds (F-4 Member edit/delete before F-5).
- "No clock port" bullet outlived features that need server "now" (sessions, throttle, today's rate).
- Second recheck pass found: Ledger needs User emails (share by email, "recorded by") although Identity exposes only the guard; Converted Total definition omitted home-currency amounts; Domain Language definitions using their own _Avoid_ words (movement, label); "entry"/bare "total" leaking; DoD fixture not matching its own steps.
- Third pass found: per-Category sums not grouped by Currency; Transfer validation order leaking existence (400 currency check before 404); client-supplied `today` driving a shared rate cache; Home Currency set/validate path with no owner endpoint; Avoid words leaking via examples ("bank account", "Move an amount", Balance banning "amount").
- Fourth pass found: a superseded register row (Q-38 "today never cached") left unmarked after Q-44 replaced it; a request param (`today` on summaries) left without a consumer once caching moved to server time; a "used only for X" convention that contradicts a later rule (Q-45 also needs `today` on writes); a new term's definition (Kind) using its own _Avoid_ word.

- Fifth pass found: a convention promising an operation no feature delivers (Removal: "Transfers are hard-deleted", but no feature deletes a Transfer); Depends On omitting a table dependency (F-6's one-wallet summary needs F-4's wallet_shares) while the linear build order hid it.
- Sixth pass found: a new delete operation (Q-50 Transfer delete) added with no read surface that lists the thing being deleted — when a decision adds update/delete, check some feature/flow/convention shows the item.
- Seventh pass found: widening who can SEE a thing (Q-51 Members see Transfers) without re-deriving the error codes of actions on it (delete still 404'd "either wallet not visible" instead of 403) and without saying what of a cross-wallet item a viewer of only one side may see (counterpart Wallet). When visibility widens, re-check 404-vs-403 and leakage of the other end.

**Why:** keeps extensions and rechecks from re-deriving names or reopening settled decisions.
**How to apply:** reuse these names/modules; any rename or seam move is a design-tree question.
