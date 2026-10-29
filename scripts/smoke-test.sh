#!/usr/bin/env bash
#
# Post-deploy smoke test for Money Management: the walking-skeleton scenarios driven through the public edge — F-1 (sign
# up, who am I, sign out, replay refused, sign in) and F-2 (create a Wallet, record an Expense, read the derived
# Balance) — plus the checks that show the release is the one that was meant to ship: the Web App is served with its
# security headers, /api is proxied, the Ledger refuses anonymous callers and hides a Wallet from every other User, and
# the test-only seed User does not exist.
#
#   bash scripts/smoke-test.sh [BASE_URL]            default http://localhost:8080
#
#   SMOKE_EXPECT_SECURE_COOKIE   true (default) | false
#       The `sid` cookie must carry Secure. True for any production deployment; false only for a stack run over plain
#       http with COOKIE_SECURE=false.
#   SMOKE_SKIP_SEED_CHECK        1 to skip the "seed User must not exist" check, for a dev environment that runs
#       Liquibase with LIQUIBASE_CONTEXTS=test on purpose.
#
# Side effects: creates TWO Users (smoke-<time>-<pid>@example.test and its "-b" twin), ONE Wallet and ONE Transaction
# per run — the API has no way to delete any of them; everything belongs to the throwaway smoke Users, never to a real
# person. It uses 7 of the edge rate limit's 30-a-minute sign-up/sign-in budget and 5 of its 60-a-minute Wallet-write
# budget (the limiter counts a refused anonymous write too). Safe to point at production.
# Exit status: 0 when every check passed, 1 at the first failure.
set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
BASE_URL="${BASE_URL%/}"
EXPECT_SECURE_COOKIE="${SMOKE_EXPECT_SECURE_COOKIE:-true}"
SKIP_SEED_CHECK="${SMOKE_SKIP_SEED_CHECK:-0}"

# An explicit template under $TMPDIR: BSD/macOS `mktemp -d` without one ignores TMPDIR (a problem in sandboxes).
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/money-management-smoke.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT
HEADERS="$WORK_DIR/headers"
BODY="$WORK_DIR/body"
STATUS=""
PASSED=0

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  PASSED=$((PASSED + 1))
  echo "ok   $*"
}

body_excerpt() {
  head -c 200 "$BODY" | tr -d '\r\n'
}

# request METHOD PATH [JSON_BODY [COOKIE]] — sets STATUS; the response headers and body stay in $HEADERS and $BODY.
request() {
  local method="$1" path="$2" json="${3-}" cookie="${4-}"
  local args=(--silent --show-error --max-time 20 --request "$method" --output "$BODY" --dump-header "$HEADERS" --write-out '%{http_code}')
  if [ -n "$json" ]; then
    args+=(--header 'Content-Type: application/json' --data "$json")
  fi
  if [ -n "$cookie" ]; then
    args+=(--header "Cookie: $cookie")
  fi
  STATUS="$(curl "${args[@]}" "$BASE_URL$path")" || fail "$method $path: could not reach $BASE_URL"
}

expect_status() { # expect_status CODE WHAT
  [ "$STATUS" = "$1" ] || fail "$2: expected HTTP $1, got $STATUS - $(body_excerpt)"
}

expect_body_contains() { # expect_body_contains TEXT WHAT
  grep -q -F -- "$1" "$BODY" || fail "$2: the response body does not contain $1 - $(body_excerpt)"
}

# header_value NAME — the first response header called NAME (case-insensitive), without the trailing CR.
header_value() {
  { grep -i "^$1:" "$HEADERS" || true; } | head -n 1 | sed -e 's/^[^:]*:[[:space:]]*//' | tr -d '\r'
}

expect_header_contains() { # expect_header_contains NAME TEXT WHAT
  case "$(header_value "$1")" in
    *"$2"*) ;;
    *) fail "$3: header $1 does not contain $2 (got: $(header_value "$1"))" ;;
  esac
}

# The Set-Cookie header of the session cookie (first one), and just its name=value pair or just its attributes.
session_cookie_header() {
  { grep -i '^set-cookie: sid=' "$HEADERS" || true; } | head -n 1 | tr -d '\r'
}

session_cookie_pair() {
  session_cookie_header | sed -e 's/^[^:]*:[[:space:]]*//' -e 's/;.*$//'
}

session_cookie_attributes() {
  session_cookie_header | sed -e 's/^[^;]*//'
}

# HttpOnly and SameSite=Lax always; Secure exactly when SMOKE_EXPECT_SECURE_COOKIE says so. Only the attributes are
# ever printed, never the session id.
expect_session_cookie_attributes() { # expect_session_cookie_attributes WHAT
  local attributes
  attributes="$(session_cookie_attributes)"
  case "$attributes" in *HttpOnly*) ;; *) fail "$1: the session cookie is not HttpOnly ($attributes)" ;; esac
  case "$attributes" in *SameSite=Lax*) ;; *) fail "$1: the session cookie is not SameSite=Lax ($attributes)" ;; esac
  case "$attributes" in
    *Secure*)
      [ "$EXPECT_SECURE_COOKIE" = "true" ] || fail "$1: the session cookie is Secure but SMOKE_EXPECT_SECURE_COOKIE=false ($attributes)"
      ;;
    *)
      [ "$EXPECT_SECURE_COOKIE" != "true" ] || fail "$1: the session cookie is not Secure - the backend must run with NODE_ENV=production and COOKIE_SECURE=true ($attributes)"
      ;;
  esac
}

echo "Smoke test: $BASE_URL"

# 1. The Web App is served, with its security headers.
request GET /
expect_status 200 "GET /"
expect_body_contains '<div id="root">' "GET /"
expect_header_contains content-security-policy "frame-ancestors 'none'" "GET /"
expect_header_contains x-content-type-options nosniff "GET /"
pass "web app served at / with its security headers"

# 2. A client-side route falls back to index.html.
request GET /sign-in
expect_status 200 "GET /sign-in"
expect_body_contains '<div id="root">' "GET /sign-in"
pass "client-side route /sign-in falls back to index.html"

# 3. The API is reachable through the edge and refuses an anonymous caller.
request GET /api/v1/me
expect_status 401 "GET /api/v1/me without a cookie"
expect_body_contains '"statusCode":401' "GET /api/v1/me without a cookie"
expect_header_contains cache-control no-store "GET /api/v1/me without a cookie"
pass "API reachable through the edge, anonymous caller refused (401, no-store)"

# 4. Sign up: writes to Postgres, so this also proves the migration ran.
EMAIL="smoke-$(date +%s)-$$@example.test"
PASSWORD='Smoke-Test-42!'
CREDENTIALS="{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"

request POST /api/v1/users "$CREDENTIALS"
expect_status 201 "sign up"
expect_body_contains "\"email\":\"$EMAIL\"" "sign up"
SESSION="$(session_cookie_pair)"
[ -n "$SESSION" ] || fail "sign up: the response carries no sid cookie"
expect_session_cookie_attributes "sign up"
pass "sign up: 201, session cookie issued with the expected attributes"

# 5. The session is accepted. (The cookie is sent by hand: curl's cookie jar would refuse to send a Secure cookie over
#    plain http, and the point here is the API, not curl.)
request GET /api/v1/me "" "$SESSION"
expect_status 200 "who am I after sign up"
expect_body_contains "\"email\":\"$EMAIL\"" "who am I after sign up"
pass "session accepted: GET /api/v1/me returns the new User"

# 6. Sign out ends the session and clears the cookie.
request DELETE /api/v1/sessions/current "" "$SESSION"
expect_status 204 "sign out"
case "$(session_cookie_header)" in *"Max-Age=0"*) ;; *) fail "sign out: the sid cookie is not cleared (no Max-Age=0)" ;; esac
pass "sign out: 204, cookie cleared"

# 7. A replayed, signed-out session is refused.
request GET /api/v1/me "" "$SESSION"
expect_status 401 "replay of the signed-out session"
pass "signed-out session refused (401)"

# 8. A wrong password gets the one uniform message. (Done before the good sign-in, which clears the failed attempt.)
request POST /api/v1/sessions "{\"email\":\"$EMAIL\",\"password\":\"Wrong-Pass-42!\"}"
expect_status 401 "sign in with a wrong password"
expect_body_contains 'Email or password is incorrect.' "sign in with a wrong password"
pass "wrong password refused with the uniform message (401)"

# 9. Sign in again, use the session, sign out.
request POST /api/v1/sessions "$CREDENTIALS"
expect_status 200 "sign in"
SESSION="$(session_cookie_pair)"
[ -n "$SESSION" ] || fail "sign in: the response carries no sid cookie"
request GET /api/v1/me "" "$SESSION"
expect_status 200 "who am I after sign in"
expect_body_contains "\"email\":\"$EMAIL\"" "who am I after sign in"
request DELETE /api/v1/sessions/current "" "$SESSION"
expect_status 204 "sign out after sign in"
pass "sign in again: 200, session works, signed out (204)"

# 10. A form-encoded body is refused: the login-CSRF guard.
STATUS="$(curl --silent --show-error --max-time 20 --output "$BODY" --dump-header "$HEADERS" --write-out '%{http_code}' \
  --request POST --data-urlencode "email=$EMAIL" --data-urlencode 'password=x' "$BASE_URL/api/v1/sessions")" \
  || fail "POST /api/v1/sessions: could not reach $BASE_URL"
expect_status 415 "form-encoded sign in"
pass "form-encoded body refused (415): login-CSRF guard"

# 11. The test-only seed User (seed.user@example.test, a known password) must not exist outside test/dev.
if [ "$SKIP_SEED_CHECK" = "1" ]; then
  echo "skip the seed User check (SMOKE_SKIP_SEED_CHECK=1)"
else
  request POST /api/v1/sessions '{"email":"seed.user@example.test","password":"Seed-Pass-1"}'
  [ "$STATUS" != "200" ] || fail "the test-only seed User can sign in: Liquibase ran with the test context here"
  expect_status 401 "sign in as the test-only seed User"
  pass "test-only seed User does not exist"
fi

# ---- F-2: Record Income and Expense in a Wallet ------------------------------------------------------------------------
# The Ledger's walking skeleton through the edge (create a Wallet, record an Expense, read the derived Balance) and the two
# access rules a release must not lose: every Ledger route is default-deny, and a Wallet is invisible to every other User.
# The date is the runner's local date, exactly what the Web App sends as `today` and pre-fills as the Transaction's date.
TODAY="$(date +%Y-%m-%d)"
UNKNOWN_WALLET_ID="00000000-0000-4000-8000-000000000000"

expect_anonymous_refused() { # expect_anonymous_refused METHOD PATH [JSON_BODY]
  request "$1" "$2" "${3-}"
  expect_status 401 "$1 $2 without a cookie"
  expect_header_contains cache-control no-store "$1 $2 without a cookie"
}

# 12. Every Ledger route refuses an anonymous caller (the global guard is default-deny, so a route added later inherits it).
expect_anonymous_refused GET /api/v1/currencies
expect_anonymous_refused GET /api/v1/wallets
expect_anonymous_refused POST /api/v1/wallets '{}'
expect_anonymous_refused GET "/api/v1/wallets/$UNKNOWN_WALLET_ID"
expect_anonymous_refused POST "/api/v1/wallets/$UNKNOWN_WALLET_ID/transactions" '{}'
pass "Ledger routes refuse an anonymous caller (401, no-store)"

# 13. A signed-in User gets the supported-Currency list: the Wallet form's picker, and the minor-unit digits of each Currency.
request POST /api/v1/sessions "$CREDENTIALS"
expect_status 200 "sign in for the Ledger checks"
SESSION="$(session_cookie_pair)"
[ -n "$SESSION" ] || fail "sign in for the Ledger checks: the response carries no sid cookie"
request GET /api/v1/currencies "" "$SESSION"
expect_status 200 "GET /api/v1/currencies"
expect_body_contains '"code":"THB","name":"Thai Baht","minorDigits":2' "GET /api/v1/currencies"
expect_body_contains '"code":"JPY","name":"Japanese Yen","minorDigits":0' "GET /api/v1/currencies"
pass "supported-Currency list served (THB has 2 minor digits, JPY has 0)"

# 14. Create a Wallet: its Balance starts at the Opening Balance. This also proves the F-2 changesets ran.
request POST /api/v1/wallets '{"name":"Smoke wallet","currency":"THB","openingBalanceMinor":"100000"}' "$SESSION"
expect_status 201 "create a Wallet"
expect_body_contains '"currency":"THB"' "create a Wallet"
expect_body_contains '"openingBalanceMinor":"100000"' "create a Wallet"
expect_body_contains '"balanceMinor":"100000"' "create a Wallet"
WALLET_ID="$({ grep -o '"id":"[0-9a-f-]\{36\}"' "$BODY" || true; } | head -n 1 | cut -d'"' -f4)"
[ -n "$WALLET_ID" ] || fail "create a Wallet: the response carries no id - $(body_excerpt)"
pass "create a Wallet: 201, Balance equals the Opening Balance"

# 15. Record an Expense in it.
request POST "/api/v1/wallets/$WALLET_ID/transactions" \
  "{\"kind\":\"expense\",\"amountMinor\":\"25050\",\"occurredOn\":\"$TODAY\",\"note\":\"smoke test\",\"today\":\"$TODAY\"}" "$SESSION"
expect_status 201 "record an Expense"
expect_body_contains '"kind":"expense"' "record an Expense"
expect_body_contains '"amountMinor":"25050"' "record an Expense"
expect_body_contains "\"occurredOn\":\"$TODAY\"" "record an Expense"
pass "record an Expense: 201, amount and date echoed exactly"

# 16. Read it back: the Balance is derived (1000.00 - 250.50 = 749.50 THB), the Transaction is listed, and the answer is
#     private (no-store). The Wallet also shows up in the User's list.
request GET "/api/v1/wallets/$WALLET_ID" "" "$SESSION"
expect_status 200 "read the Wallet"
expect_body_contains '"balanceMinor":"74950"' "read the Wallet"
expect_body_contains '"note":"smoke test"' "read the Wallet"
expect_body_contains "\"occurredOn\":\"$TODAY\"" "read the Wallet"
expect_header_contains cache-control no-store "read the Wallet"
request GET /api/v1/wallets "" "$SESSION"
expect_status 200 "list the Wallets"
expect_body_contains "\"id\":\"$WALLET_ID\"" "list the Wallets"
pass "Balance derived (74950 minor units = THB 749.50), Transaction listed, Wallet in the list, answer not cacheable"

# 17. Another User cannot see that Wallet or record into it: 404, never 403 (no existence leak), and the owner's Balance is untouched.
OTHER_EMAIL="smoke-$(date +%s)-$$-b@example.test"
request POST /api/v1/users "{\"email\":\"$OTHER_EMAIL\",\"password\":\"$PASSWORD\"}"
expect_status 201 "sign up a second User"
OTHER_SESSION="$(session_cookie_pair)"
[ -n "$OTHER_SESSION" ] || fail "sign up a second User: the response carries no sid cookie"
request GET "/api/v1/wallets/$WALLET_ID" "" "$OTHER_SESSION"
expect_status 404 "another User reads the Wallet"
expect_body_contains 'Wallet not found.' "another User reads the Wallet"
request POST "/api/v1/wallets/$WALLET_ID/transactions" \
  "{\"kind\":\"income\",\"amountMinor\":\"1\",\"occurredOn\":\"$TODAY\",\"today\":\"$TODAY\"}" "$OTHER_SESSION"
expect_status 404 "another User records into the Wallet"
request GET /api/v1/wallets "" "$OTHER_SESSION"
expect_status 200 "another User lists Wallets"
expect_body_contains '"wallets":[]' "another User lists Wallets"
request GET "/api/v1/wallets/$WALLET_ID" "" "$SESSION"
expect_status 200 "the owner re-reads the Wallet"
expect_body_contains '"balanceMinor":"74950"' "the owner re-reads the Wallet"
pass "another User gets 404 for the Wallet, cannot record into it and lists none; the owner's Balance is untouched"

# 18. The Ledger screens survive a reload: their client-side routes fall back to index.html (a Wallet's deep link included).
request GET /wallets/new
expect_status 200 "GET /wallets/new"
expect_body_contains '<div id="root">' "GET /wallets/new"
request GET "/wallets/$WALLET_ID"
expect_status 200 "GET /wallets/{id}"
expect_body_contains '<div id="root">' "GET /wallets/{id}"
pass "client-side routes /wallets/new and /wallets/{id} fall back to index.html"

# 19. Leave no live session behind: both smoke Users sign out.
request DELETE /api/v1/sessions/current "" "$SESSION"
expect_status 204 "sign out after the Ledger checks"
request DELETE /api/v1/sessions/current "" "$OTHER_SESSION"
expect_status 204 "sign out the second User"
pass "both smoke Users signed out (204)"

echo "All $PASSED smoke checks passed against $BASE_URL"
