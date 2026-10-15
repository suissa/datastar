# SSE over HTTP/3 (QUIC)

Datastar does not need a separate QUIC protocol implementation to use QUIC for server-sent events. Datastar's normal HTTP streaming requests can use HTTP/3 when the browser, origin or reverse proxy, TLS configuration, and network path negotiate HTTP/3. HTTP/3 runs over QUIC; the application payload remains the existing Datastar SSE event format.

This is an opt-in deployment capability, not a new Datastar event type or a guarantee that every request uses HTTP/3. Keep the application endpoint and SSE framing unchanged, and preserve HTTP/2 or HTTP/1.1 as fallbacks.

## Request path

```text
Datastar browser runtime
  -> fetch() / text/event-stream
  -> HTTP/3 stream (when negotiated)
  -> QUIC over UDP
  -> HTTP/3-capable origin or reverse proxy
  -> existing Datastar handler
```

The browser chooses the negotiated HTTP version. Application JavaScript cannot force a browser's Fetch API to use HTTP/3. Do not implement a custom QUIC client in the Datastar frontend.

## Example: Caddy reverse proxy

Caddy can terminate HTTPS and proxy requests to an existing Datastar application. Configure the site with a valid hostname and ensure UDP port 443 is reachable from clients as well as TCP port 443.

```caddyfile
{
    servers {
        protocols h1 h2 h3
    }
}

example.com {
    reverse_proxy app:8080
}
```

Replace `example.com` and `app:8080` with your deployment values. The upstream connection from Caddy to the application may use HTTP/1.1 or HTTP/2; clients can still use HTTP/3 to Caddy. Check the documentation for the exact Caddy version and hosting environment you deploy.

If UDP/443 is blocked, the browser may fall back to HTTP/2 or HTTP/1.1. Some CDNs and load balancers terminate HTTP/3 at the edge and proxy to the origin over another HTTP version.

## Application requirements

- Keep returning `Content-Type: text/event-stream` for SSE responses.
- Flush each complete event promptly; do not buffer the stream in the application or proxy.
- Send appropriate cache and proxy-buffering controls for the server/proxy you use.
- Handle client disconnects and cancellation so work associated with a closed stream is stopped when possible.
- Keep reconnection behavior and Datastar event framing unchanged.
- Do not assume that an HTTP/3 client-to-edge connection means the edge-to-origin connection is also HTTP/3.

## Verify the transport

Use a browser's Network panel or an HTTP/3-capable client to verify the negotiated protocol. For curl, first check that the installed build supports HTTP/3 with `curl --version`. Then run the smoke test in `scripts/test-sse-http3.sh` against an existing SSE endpoint.

A successful HTTP/3 handshake alone is insufficient: verify that a complete Datastar SSE event arrives and that the stream is not buffered.

The repository also includes an isolated integration test module in `tests/http3/` and a GitHub Actions workflow at `.github/workflows/http3-quic.yml`. It starts a local HTTP/3 server over UDP, asserts that the client negotiated HTTP/3, and reads a complete `datastar-patch-elements` SSE event before the stream closes. Run it locally with `cd tests/http3 && go test -v -count=1 ./...`.

`examples/http3/transport.json` records the intended deployment policy: prefer HTTP/3 over QUIC, keep Datastar SSE framing unchanged, flush events without buffering, and allow HTTP/2 and HTTP/1.1 fallback. This is a deployment/configuration example, not a browser-side protocol switch; the browser still negotiates HTTP/3 with the server or edge proxy.

## Benchmark before recommending it

Compare the same endpoint over HTTP/2 and HTTP/3 with equivalent payloads and concurrency. Record time-to-first-event and event delivery latency (p50/p95/p99), disconnect/reconnect behavior, dropped or duplicated application events, CPU and memory per connection, and behavior under packet loss and network changes. QUIC may improve connection setup or loss behavior in some environments; it does not guarantee lower application latency in every deployment.
