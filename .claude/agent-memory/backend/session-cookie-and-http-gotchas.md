---
name: session-cookie-and-http-gotchas
description: Express 5 / NestJS cookie, validation-pipe, concurrency and Postgres behaviours that shaped the F-1 Identity implementation (and what Stage 14 hardened)
metadata:
  type: project
---

- **Cleared cookie needs `Max-Age=0`** (Bruno AT-02-03). Express 5 `res.clearCookie` ignores `maxAge` and sends only `Expires`; use `res.cookie('sid', '', { maxAge: 0, … })`. The global guard re-sends the sliding cookie on the sign-out request too, so `SessionCookie.clear` first drops the queued `sid=` header — otherwise two contradicting `Set-Cookie`s go out.
- **One validation message per field, once:** `ValidationPipe({ whitelist, transform, stopAtFirstError })` from `createValidationPipe()`; DTO specs run the real pipe (`test/support/dto-validation.ts`). The password rule is ONE `@Matches` regex. **Decorators run bottom-up and `stopAtFirstError` keeps the first failure**, so on `SignInDto.email` the `@MaxLength` (different message) sits on TOP of `@IsString`/`@IsNotEmpty` — reorder and a missing email would say "Enter a valid email address.".
- **Taken email = unique-constraint race, not a pre-check:** repository maps Postgres `23505` on `users_email_key` to `null`; proved by two simultaneous sign-ups (exactly one 201 + one 409). The schema also has `CHECK (email = lower(email))`.
- **All time is Postgres `now()`:** session expiry, the 15-minute sign-in window and `retryAt` come from DB timestamps; tests drive time by inserting rows with `now() - make_interval(…)` (`storeFailedSignIn`). `pg` returns `count(*)` as a string unless cast `::int`.
- **The throttle's check → verify → record is NOT atomic by itself:** a burst of parallel wrong guesses all passed the 10-failure check (the unit test saw 15 verifications, not 10). Fixed with an injected in-process `KeyedMutex` (`SIGN_IN_LOCK`) around the whole attempt, per email; with N app replicas the overshoot is bounded by N−1 (a DB advisory lock would make it exact but holds pool connections while waiting).
- **Only JSON bodies are accepted (415)** — Nest registers urlencoded parsing by default, which allowed a cross-site form post to log a victim in (login CSRF). `requireJsonBody()` runs before the parsers because `configureApp` is called before `init()`. A `fetch` string body without `Content-Type: application/json` is sent as `text/plain` and now gets 415 — the Mountebank impostor mirrors this so mock mode cannot hide the slip.
- **Sign-in `email` is capped at 254** (no User can have more) so a failed guess cannot store an unbounded value in `sign_in_attempts`.
- Unknown-email sign-in still performs one argon2 verify against a lazily created dummy hash (timing equalisation).
- `@nestjs/platform-express@11` pins `multer@2.4.0` (high DoS advisory, unused code path); `package.json` `overrides: { multer: "2.5.0" }` clears `npm audit --omit=dev`. Re-check the override when bumping Nest.
- Supertest on an unstarted Nest app re-listens per request and trips `MaxListenersExceededWarning`; `createTestApp()` listens once on `127.0.0.1:0`.
