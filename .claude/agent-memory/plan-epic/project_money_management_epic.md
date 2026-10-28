---
name: project-money-management-epic
description: Planning conventions chosen for the money-management epic (first drafted 2026-10-28) — modules, money/date representation, naming
metadata:
  type: project
---

First epic drafted 2026-10-28 from a one-line idea (wallets, income/expense, weekly + monthly summary). Stack: NestJS + React/Vite + Postgres (raw `pg`), no external APIs.

Drafting choices to stay consistent with on any Epic Extension (verify against current `epic.md` first — the user may have changed them in grilling):
- Two backend modules only: **Ledger** (wallets, transactions, categories, transfers, derived balances) and **Summary** (read-only period aggregation). Splitting Ledger was rejected by the deletion test — shared invariants (archive rule, kind matching).
- Money = BIGINT minor units, `*Minor` fields, JSON decimal strings; amounts always > 0 with direction from `kind`.
- Transaction date = `occurredOn` DATE, no time (AD-1) — avoids timezone bucketing bugs; `pg` DATE→JS Date parsing is a known walking-skeleton risk.
- Canonical "Transaction" / "Transfer" / "Period Summary" / "Net" were agent-invented; the user's own words were only "income", "expense", "wallet", "summary".

**Why:** keeps extensions from re-deriving names or splitting modules differently.
**How to apply:** reuse these names/modules in extensions; any rename is a design-tree question.
