package http3test

import (
	"bufio"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"io"
	"math/big"
	"net"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/quic-go/quic-go/http3"
)

const datastarEvent = "event: datastar-patch-elements\ndata: {\"elements\":\"<div id=\\\"quic-proof\\\">SSE over QUIC works</div>\"}\n\n"

func testCertificate(t *testing.T) tls.Certificate {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject: pkix.Name{CommonName: "localhost"},
		NotBefore: time.Now().Add(-time.Minute),
		NotAfter: time.Now().Add(time.Hour),
		KeyUsage: x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		DNSNames: []string{"localhost"},
		IPAddresses: []net.IP{net.ParseIP("127.0.0.1")},
	}
	der, err := x509.CreateCertificate(rand.Reader, &template, &template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})
	cert, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil {
		t.Fatal(err)
	}
	return cert
}

func startHTTP3(t *testing.T) (string, func()) {
	t.Helper()
	packetConn, err := net.ListenPacket("udp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		_, _ = io.WriteString(w, "HTTP/3 over QUIC OK")
	})
	mux.HandleFunc("/events", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("X-Accel-Buffering", "no")
		w.WriteHeader(http.StatusOK)
		flusher, ok := w.(http.Flusher)
		if !ok {
			return
		}
		_, _ = io.WriteString(w, datastarEvent)
		flusher.Flush()
		<-r.Context().Done()
	})

	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{testCertificate(t)},
		NextProtos: []string{http3.NextProtoH3},
		MinVersion: tls.VersionTLS13,
	}
	server := &http3.Server{Handler: mux, TLSConfig: tlsConfig}
	go func() {
		_ = server.Serve(packetConn)
	}()

	addr := "https://" + packetConn.LocalAddr().String()
	cleanup := func() {
		_ = server.Close()
		_ = packetConn.Close()
	}
	return addr, cleanup
}

func newHTTP3Client() *http3.Transport {
	return &http3.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true, MinVersion: tls.VersionTLS13}, // test-only self-signed certificate
	}
}

func TestQUICNegotiatesHTTP3(t *testing.T) {
	baseURL, cleanup := startHTTP3(t)
	defer cleanup()

	transport := newHTTP3Client()
	defer transport.Close()
	client := &http.Client{Transport: transport, Timeout: 5 * time.Second}

	resp, err := client.Get(baseURL + "/health")
	if err != nil {
		t.Fatalf("HTTP/3 request over QUIC failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.ProtoMajor != 3 || resp.Proto != "HTTP/3.0" {
		t.Fatalf("expected negotiated HTTP/3, got %q (major=%d)", resp.Proto, resp.ProtoMajor)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "HTTP/3 over QUIC OK" {
		t.Fatalf("unexpected health response: %q", body)
	}
}

func TestDatastarSSEStreamsOverHTTP3(t *testing.T) {
	baseURL, cleanup := startHTTP3(t)
	defer cleanup()

	transport := newHTTP3Client()
	defer transport.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/events", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Accept", "text/event-stream")
	resp, err := transport.RoundTrip(req)
	if err != nil {
		t.Fatalf("SSE request over QUIC/HTTP/3 failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.ProtoMajor != 3 {
		t.Fatalf("SSE response did not use HTTP/3: %q", resp.Proto)
	}
	if got := resp.Header.Get("Content-Type"); !strings.HasPrefix(got, "text/event-stream") {
		t.Fatalf("expected text/event-stream, got %q", got)
	}

	// Read a complete event from the live stream; do not buffer until EOF.
	reader := bufio.NewReader(resp.Body)
	var event strings.Builder
	for {
		line, readErr := reader.ReadString('\n')
		if readErr != nil {
			t.Fatalf("stream ended before a complete SSE event arrived: %v", readErr)
		}
		event.WriteString(line)
		if line == "\n" {
			break
		}
	}
	payload := event.String()
	if !strings.Contains(payload, "event: datastar-patch-elements") ||
		!strings.Contains(payload, "quic-proof") ||
		!strings.Contains(payload, "SSE over QUIC works") {
		t.Fatalf("received HTTP/3 data but not the expected Datastar SSE event: %q", payload)
	}
}
