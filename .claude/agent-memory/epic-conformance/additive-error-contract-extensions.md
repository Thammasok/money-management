---
name: additive-error-contract-extensions
description: How this gate judges additive HTTP/contract extensions (415, 429 retryAt, deep-nesting 400, edge 429, extra read endpoints, input caps) — conformant, filed as PA-n plan amendments
metadata:
  type: project
---

Additive extensions to the epic's contract were judged CONFORMANT, each with a non-blocking "plan amendment" (PA-n)
for the user. An extension is additive when it keeps Nest's default `{ statusCode, message, error }` shape, does not
change the status of a listed case, and does not contradict a Q-/A-/AD- rule.
- F-1: PA-1 429 `retryAt`, PA-2 415 non-JSON, PA-3 Liquibase `--contexts=prod`.
- F-2: PA-4 `GET /currencies` in Exchange Rates, PA-5 a minimal `GET /wallets` without Balances (navigation + Q-11,
  so not F-3 pulled forward), PA-6 input caps, PA-7 `en-US` money display, PA-8 deep-nesting 400, PA-9 edge 429 on
  Wallet writes, PA-10 Wallet body without `userId`.

Drift would be a changed body shape, a different status for a listed case, a contradiction of a Q-/AD- rule, or a
later feature's behaviour (for example, Balances or Currency Totals on the list before F-3).

**Why:** the epic's status list describes domain outcomes and does not forbid transport hardening. Halting an
autonomous run for an additive field costs more than recording it.

**How to apply:** at each later gate, check whether the PAs have been folded into epic.md. As of F-2, none had,
including PA-1..3. Apply the same additive-vs-contradicting test to new statuses or fields. OQ-1 (raw session token)
is still pending: if epic.md changes Session to a hashed id, a later gate must check that Identity was migrated.
