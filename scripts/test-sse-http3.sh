#!/usr/bin/env bash
set -euo pipefail

# Smoke-test an existing SSE endpoint over HTTP/3.
# Usage:
#   EXPECTED_EVENT='datastar-patch-elements' bash scripts/test-sse-http3.sh https://example.com/events
#
# The endpoint must emit EXPECTED_EVENT in a complete SSE event shortly after
# connection. curl must be built with HTTP/3 support. A timeout is expected
# because a healthy SSE connection normally stays open.

url="${1:-}"
if [[ -z "$url" ]]; then
  echo "Usage: EXPECTED_EVENT='substring' bash $0 https://host/path" >&2
  exit 2
fi

expected="${EXPECTED_EVENT:-}"
if [[ -z "$expected" ]]; then
  echo "Set EXPECTED_EVENT to a stable substring emitted by the SSE endpoint." >&2
  exit 2
fi

if ! curl --version | grep -qi 'HTTP3'; then
  echo "This curl build does not advertise HTTP/3 support." >&2
  exit 2
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

set +e
timeout "${SSE_TEST_TIMEOUT:-8}s" curl --http3-only --no-buffer --silent --show-error \
  --fail --max-time "${SSE_TEST_TIMEOUT:-8}" \
  -H 'Accept: text/event-stream' \
  -H 'Cache-Control: no-cache' \
  "$url" >"$tmp"
curl_status=$?
set -e

if grep -Fq "$expected" "$tmp"; then
  echo "PASS: received expected SSE payload over HTTP/3: $expected"
  exit 0
fi

echo "FAIL: expected payload was not received over HTTP/3." >&2
echo "curl/timeout exit status: $curl_status" >&2
echo "Received response (first 80 lines):" >&2
sed -n '1,80p' "$tmp" >&2
exit 1
