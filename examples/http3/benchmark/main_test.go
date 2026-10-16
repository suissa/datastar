package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestDistributionCalculatesPercentiles(t *testing.T) {
	got := distribution([]float64{9, 1, 5, 3, 7})
	if got.Min != 1 || got.P50 != 5 || got.P95 != 9 || got.P99 != 9 || got.Max != 9 || got.Mean != 5 {
		t.Fatalf("unexpected distribution: %+v", got)
	}
}

func TestSampleReportMatchesDashboardSchema(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("..", "benchmark-sample.json"))
	if err != nil { t.Fatal(err) }
	var r Report
	if err := json.Unmarshal(data, &r); err != nil { t.Fatalf("sample JSON invalid: %v", err) }
	if r.SchemaVersion != 1 || (r.Mode != "sample" && r.Mode != "measured") { t.Fatalf("unexpected report metadata: %+v", r) }
	for _, key := range []string{"http2", "http3"} {
		m, ok := r.Results[key]
		if !ok { t.Fatalf("missing %s metrics", key) }
		if m.Protocol == "" || m.RequestLatencyMs.P50 <= 0 || m.SSE.EventsReceived <= 0 {
			t.Fatalf("incomplete %s sample metrics: %+v", key, m)
		}
	}
}

func TestTransportConfigDeclaresHTTP3AndOverwrite(t *testing.T) {
	data, err := os.ReadFile("transport.json")
	if err != nil { t.Fatal(err) }
	var cfg struct {
		HTTP3 struct { Enabled bool `json:"enabled"`; Carrier string `json:"carrier"` } `json:"http3"`
		Results struct { Overwrite bool `json:"overwriteOnRun"` } `json:"results"`
	}
	if err := json.Unmarshal(data, &cfg); err != nil { t.Fatalf("transport config invalid: %v", err) }
	if !cfg.HTTP3.Enabled || cfg.HTTP3.Carrier != "QUIC" || !cfg.Results.Overwrite {
		t.Fatalf("config must enable HTTP/3 over QUIC and overwrite JSON results: %+v", cfg)
	}
}
