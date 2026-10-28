---
name: additive-error-contract-extensions
description: How this gate judged additive HTTP contract extensions (415 non-JSON, 429 retryAt) vs the epic's Error-handling status list — conformant, flagged as plan amendments
metadata:
  type: project
---

Additive extensions to the epic's Error-handling convention (an extra status like 415 for non-JSON bodies, an
extra field like `retryAt` on 429) that keep Nest's default `{ statusCode, message, error }` shape and come from
a tested security fix were judged CONFORMANT at F-1, with a non-blocking "plan amendment" (PA-n) for the user.
Drift would be: a changed body shape, a different status for a listed case, or a contradiction of a Q-/AD- rule.

**Why:** the epic's status list describes domain outcomes; it does not forbid transport hardening, and halting an
autonomous run for an additive field costs more than recording it. F-1 report: artifacts/F-1/11-conformance-report.md.

**How to apply:** for later features, check whether PA-1..PA-3 (429 retryAt, 415, Liquibase `--contexts=prod`)
were folded into epic.md; if a feature adds further undocumented statuses/fields, use the same additive-vs-
contradicting test. Also: the raw-session-token question (OQ-1) is pending with the user — if epic.md changes
Session to a hashed id, a later feature's conformance must check Identity was migrated.
