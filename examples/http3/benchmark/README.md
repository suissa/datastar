# Datastar HTTP/2 vs HTTP/3 benchmark dashboard

This is an opt-in test harness in the existing Datastar repository, not a separate product or a new transport protocol. It serves the dashboard and Datastar SSE stream from one Go process over HTTPS/TCP (HTTP/2) and HTTPS/UDP (HTTP/3 over QUIC).

## Run locally

Requires Go 1.23+ and network access to download Go module dependencies.

    cd examples/http3/benchmark
    go mod tidy
    go run . -addr 127.0.0.1:8443

Open https://127.0.0.1:8443/ and accept the locally generated self-signed certificate warning. The certificate is for local testing only. Both TCP/8443 and UDP/8443 must be available. A browser may select HTTP/2 or HTTP/3 based on support and Alt-Svc/network negotiation; the dashboard does not force a browser protocol.

Click **Run benchmark** to compare equivalent payload and SSE-stream tests over both protocols. The server overwrites ../benchmark-results.json with measurements and updates the dashboard. The checked-in ../benchmark-sample.json seeds the UI before a run; its values are illustrative and explicitly labelled sample data.

## Metrics

- Request latency: min, p50, p95, p99, max, mean for a fixed payload.
- Throughput estimate for the payload request workload.
- SSE time to first event, total stream duration, observed events/second, and event count.
- Protocol identity reported by each HTTP client.

This is a local microbenchmark, not a general QUIC performance claim. The HTTP/2 and HTTP/3 paths run on the same machine and share application code, but TCP and UDP have different kernel scheduling and congestion behavior. Repeat on target infrastructure with representative latency, packet loss, concurrency, payloads, and proxy settings before making deployment decisions. The local harness does not simulate packet loss and does not measure browser rendering or production edge-to-origin paths.

## Datastar behavior

The dashboard is served by this Go HTTP handler and uses the official Datastar browser bundle for its run action. The /datastar/benchmark endpoint emits datastar-patch-elements SSE updates; the dashboard reloads the JSON report after the run completes. SSE event framing remains the standard Datastar format.
