---
name: validation-must-match-postgres
description: API validation must agree exactly with Postgres constraints and types or valid-looking input becomes a 500 — the F-2 traps (character counting, NUL, DATE, nested bodies) and the two throwaway probes that found them
metadata:
  type: project
---

**Rule:** every limit the database enforces (CHECK, type, encoding) must be enforced by the DTO the *same way*, or some plausible input reaches Postgres and comes back as a 500. None of these were caught by the scenarios — a hostile-input probe against the running backend found them.

**Traps already hit (and fixed in the repo — reuse the fixes):**
- `@MaxLength` (class-validator → validator.js `isLength`) also discounts variation selectors U+FE0E/FE0F, so `'❤️'.repeat(31)` is "31" to the API but 62 code points to Postgres `char_length` → the CHECK refuses it → 500. Use code-point counting (`Array.from(text).length`) wherever a CHECK uses `char_length`: `backend/src/ledger/validation/character-count.ts`, decorator `MaxCharacters`.
- Postgres `text` cannot hold U+0000: strip NULs while trimming (`ledger/dto/clean-text.ts`).
- `pg` parses `DATE` as a local-midnight JS `Date` (the day shifts east of Greenwich). The Pool is built only by `database/create-pool.ts` (DATE → string; BIGINT and NUMERIC are already strings by default). Tests must build pools with `createTestPool()`, never `new Pool`. `SUM(bigint)` is NUMERIC in Postgres (cannot overflow) — cast `::text`, `BigInt()` in the domain.
- Nest's own `ValidationPipe.stripProtoKeys` recurses over the whole body: a body nested thousands of levels (it fits in the 100 KB limit) threw `RangeError` → 500 on EVERY endpoint, public ones included. `validation-pipe.ts` now returns a `BoundedValidationPipe` (→ 400). Keep any new global pipe wrapped the same way.

**How to apply (before Stage 14 sign-off of any feature that stores user text, numbers or dates):**
1. List every DB CHECK / type limit; make the DTO rule count identically; add a real-Postgres test at the boundary (`N` and `N+1` of the awkward characters).
2. Run a throwaway hostile-input probe (a `.mjs` in the scratchpad using `fetch`) against the running backend: 200 KB body (413), 90 KB strings, 5 000–45 000-deep nested JSON on a typed field, NUL, emoji with variation selectors at the length limit, `__proto__`/`constructor` keys, SQL and `<script>` text (stored verbatim), PUT/PATCH/DELETE (404), form / multipart / `+json` content types (415), Authorization header instead of the cookie, two `sid` cookies. Read the backend's task output file for `RangeError`/stack traces — a 500 body is generic and hides the cause.
3. Run a throwaway impostor-vs-real **parity probe**: send the same ~100 requests to Mountebank :4545 and the real backend :3000 and diff `{status, body}` with object keys sorted (Nest and the impostor order keys differently) and ids/timestamps normalised to order-of-appearance. The double had two disagreements the Bruno suite never exercised (UTF-16 length vs characters; Currency message merged with other field messages). Fix the double, never an assertion.
