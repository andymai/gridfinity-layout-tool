#!/usr/bin/env bash
# Smoke for the self-hosted image: docker/smoke.sh <base-url> <image>
# Asserts the routing and header parity that docker/nginx.conf promises, against
# a running container. EXPECTED_SHA / EXPECTED_VERSION pin version.json when set.
set -uo pipefail

BASE="${1:?base url, e.g. http://127.0.0.1:8080}"
IMAGE="${2:?image tag, e.g. ghcr.io/andymai/gridfinity-layout-tool:latest}"
FAILURES=0
UUID="0f3b6a1e-2c4d-4e8f-9a1b-3c5d7e9f0a1b"
ID="AbCdEfGhIjKl"

fail() { echo "FAIL: $*" >&2; FAILURES=$((FAILURES + 1)); }
pass() { echo "ok:   $*"; }

# fetch <path> [curl args...]: sets STATUS, HEADERS, BODY_FILE
BODY_FILE="$(mktemp)"
HDR_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE" "$HDR_FILE"' EXIT
fetch() {
  local path="$1"; shift
  STATUS="$(curl -s -o "$BODY_FILE" -D "$HDR_FILE" -w '%{http_code}' "$@" "$BASE$path")"
  HEADERS="$(tr -d '\r' < "$HDR_FILE")"
}
header() { printf '%s\n' "$HEADERS" | awk -v k="$(printf '%s' "$1" | tr 'A-Z' 'a-z')" 'BEGIN{IGNORECASE=0} { h=$1; sub(":$","",h); if (tolower(h)==k) { $1=""; sub(/^ /,""); print } }' | head -1; }
expect_status() { local path="$1" want="$2"; shift 2; fetch "$path" "$@"; if [ "$STATUS" = "$want" ]; then pass "$path -> $STATUS"; else fail "$path -> $STATUS, wanted $want"; fi; }
expect_header() { local name="$1" want="$2"; local got; got="$(header "$name")"; if [ "$got" = "$want" ]; then pass "  $name: $got"; else fail "  $name: '$got', wanted '$want'"; fi; }
expect_header_absent() { local name="$1"; local got; got="$(header "$name")"; if [ -z "$got" ]; then pass "  $name absent"; else fail "  $name present: '$got'"; fi; }
expect_ct() { local want="$1"; local got; got="$(header Content-Type)"; case "$got" in "$want"*) pass "  content-type: $got" ;; *) fail "  content-type: '$got', wanted '$want'" ;; esac; }
expect_body_contains() { if grep -q -- "$1" "$BODY_FILE"; then pass "  body contains $1"; else fail "  body lacks $1"; fi; }
expect_body_lacks() { if grep -q -- "$1" "$BODY_FILE"; then fail "  body contains $1"; else pass "  body lacks $1"; fi; }

echo "== 0. config validates"
if docker run --rm --entrypoint nginx "$IMAGE" -t >/dev/null 2>&1; then pass "nginx -t"; else fail "nginx -t"; fi

echo "== 1. shell and route entries"
expect_status / 200; expect_ct text/html
expect_header Cross-Origin-Opener-Policy same-origin
expect_header Cross-Origin-Embedder-Policy credentialless
expect_header X-Content-Type-Options nosniff
expect_header Cache-Control "public, max-age=0, must-revalidate"
expect_header_absent Strict-Transport-Security
SHELL_SUM="$(md5sum < "$BODY_FILE")"
MAIN="$(grep -o 'assets/main-[A-Za-z0-9_-]*\.js' "$BODY_FILE" | head -1)"
[ -n "$MAIN" ] && pass "main entry $MAIN" || fail "no main entry in shell"
expect_status /designer 200; expect_ct text/html
[ "$(md5sum < "$BODY_FILE")" != "$SHELL_SUM" ] && pass "  /designer serves its own entry" || fail "  /designer served the shell"
expect_status /baseplate 200
expect_status /supporters 200; expect_ct text/html
expect_status /community 200
expect_status "/community/d/$ID" 200; expect_ct text/html
[ "$(md5sum < "$BODY_FILE")" = "$SHELL_SUM" ] && pass "  /community/d/:id serves the shell" || fail "  /community/d/:id body differs from the shell"
expect_status "/s/$ID" 200
expect_status "/l/$ID/some-slug" 200
expect_status "/l/$UUID" 200
expect_status "/scan/$UUID" 200
expect_status / 200 -H 'X-Forwarded-Proto: https'; expect_header Strict-Transport-Security "max-age=63072000; includeSubDomains"

echo "== 2. content pages"
expect_status /guide 200; expect_ct text/html; expect_header Cache-Control "public, max-age=3600, stale-while-revalidate=86400"
expect_status /gridfinity-generator 200
expect_status /de/guide 200; expect_header Content-Language de; expect_header Cache-Control "public, max-age=3600, stale-while-revalidate=86400"
expect_status /schema 200

echo "== 3. redirects"
expect_status /generator 308; expect_header Location /gridfinity-generator
expect_status "/sizes?x=1" 308; expect_header Location "/gridfinity-sizes?x=1"
expect_status /guide/ 308; expect_header Location /guide

echo "== 4. api is off"
expect_status /api/share 503 -X POST; expect_ct application/json; expect_header Cache-Control no-store; expect_body_contains SERVICE_UNAVAILABLE
expect_status /api/auth/me 503; expect_ct application/json
expect_status /api/x.json 503; expect_ct application/json
expect_status /api/auth/login/google 503 -H 'Accept: text/html,*/*;q=0.8'; expect_ct text/html; expect_body_contains 'Back to the app'
head -c 2000000 /dev/zero > "$HDR_FILE.big"
expect_status /api/ml-telemetry 503 -X POST -H 'Expect:' --data-binary "@$HDR_FILE.big"; expect_ct application/json
rm -f "$HDR_FILE.big"
expect_status /api/__503.json 404

echo "== 5. not found, no catch-all"
expect_status /does-not-exist 404; expect_header Cache-Control no-store; expect_header X-Content-Type-Options nosniff
expect_status /assets/does-not-exist.js 404; expect_header Cache-Control no-store
expect_status /de/privacy 404
expect_status /l/short 404
expect_status /generatorx 404
expect_status "/$MAIN.map" 404
expect_status /Version.json 404

echo "== 6. asset headers and types"
expect_status "/$MAIN" 200 -H 'Accept-Encoding: gzip'; expect_ct application/javascript; expect_header Cache-Control "public, max-age=31536000, immutable"; expect_header Content-Encoding gzip
expect_status "/$MAIN" 304 -H 'If-None-Match: *'; expect_header Cache-Control "public, max-age=31536000, immutable"
expect_status /sw.js 200; expect_ct application/javascript; expect_header Cache-Control "public, max-age=0, must-revalidate"
expect_status /manifest.webmanifest 200; expect_ct application/manifest+json
expect_status /draco/draco_decoder.wasm 200; expect_ct application/wasm
expect_status /storage-bridge.html 200; expect_header Cross-Origin-Resource-Policy cross-origin
expect_status /version.json 200; expect_ct application/json; expect_header Cache-Control "no-store, max-age=0"
if [ -n "${EXPECTED_VERSION:-}" ]; then expect_body_contains "\"version\": \"$EXPECTED_VERSION\""; fi
if [ -n "${EXPECTED_SHA:-}" ]; then expect_body_contains "\"gitSha\": \"$EXPECTED_SHA\""; fi
expect_body_lacks '"gitSha": "unknown"'

echo "== 7. no analytics in the self-hosted bundle"
expect_status "/$MAIN" 200; expect_body_lacks '_vercel/insights'

echo
if [ "$FAILURES" -eq 0 ]; then echo "smoke: all checks passed"; else echo "smoke: $FAILURES check(s) failed" >&2; exit 1; fi
