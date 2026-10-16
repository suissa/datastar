# HTTP/3 benchmark implementation report

## Scope

The work stays inside the existing Datastar repository. It adds an opt-in reference configuration, a local benchmark server, test coverage, and an HTML dashboard. It does not add a new protocol to Datastar and does not make browsers force HTTP/3.

## Reference configuration

- examples/http3/benchmark/transport.json declares HTTP/2 over TCP and HTTP/3 over QUIC on the same numeric port, TLS 1.3+, benchmark limits, and JSON overwrite behavior.
- examples/http3/transport.json remains the high-level deployment policy for the framework.
- examples/http3/Caddyfile documents the production-style edge-proxy option; replace its hostname/upstream and expose TCP/443 and UDP/443.

## Benchmark and dashboard

examples/http3/benchmark/main.go serves the dashboard, payload endpoint and SSE endpoint over both transports. Its benchmark clients explicitly verify the negotiated HTTP major version. It measures latency percentiles, payload throughput estimate, SSE time to first event, total duration, event rate and event count. Each run writes measured JSON reports into examples/http3/benchmark-results.json and examples/http3/benchmark-sample.json, replacing the seed values so the dashboard can keep using the same schema and UI.

examples/http3/benchmark/dashboard.html is a responsive, dark HTML page with the fixed DATASTAR benchmarks report header and the requested rocket image. It uses Tailwind CDN, Animate.css, Lucide icons, Plotly charts including interactive 3D surface/scatter views, and the official Datastar browser bundle for the run action. The /datastar/benchmark endpoint streams Datastar patch events while a run executes.

The initial benchmark-sample.json supplies illustrative values only. It is not performance evidence. A measured report is marked mode: measured and includes workload metadata.

## Validation coverage

The workflow .github/workflows/http3-benchmark.yml builds the harness, runs Go tests with the race detector, runs go vet, validates the JSON fixtures, and checks that the dashboard and Datastar SSE hook are present.

The local microbenchmark does not simulate packet loss, browser rendering, concurrent production users, or a real CDN/proxy path. A production conclusion requires repeatable runs in the target network and deployment environment. The local generated TLS certificate is for development only.
