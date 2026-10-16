package main

import (
	"bufio"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"flag"
	"fmt"
	"io"
	"math"
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/quic-go/quic-go/http3"
)

type Distribution struct {
	Min float64 `json:"min"`
	P50 float64 `json:"p50"`
	P95 float64 `json:"p95"`
	P99 float64 `json:"p99"`
	Max float64 `json:"max"`
	Mean float64 `json:"mean"`
}
type SSE struct {
	TimeToFirstEventMs float64 `json:"timeToFirstEventMs"`
	TotalDurationMs float64 `json:"totalDurationMs"`
	EventsPerSecond float64 `json:"eventsPerSecond"`
	EventsReceived int `json:"eventsReceived"`
}
type Metrics struct {
	Protocol string `json:"protocol"`
	RequestLatencyMs Distribution `json:"requestLatencyMs"`
	ThroughputMbps float64 `json:"throughputMbps"`
	SSE SSE `json:"sse"`
}
type Report struct {
	SchemaVersion int `json:"schemaVersion"`
	GeneratedAt time.Time `json:"generatedAt"`
	Mode string `json:"mode"`
	Environment map[string]any `json:"environment"`
	Results map[string]Metrics `json:"results"`
	Comparison map[string]any `json:"comparison"`
}
type Settings struct { Rounds, Payload, Events, Interval int }
var (
	root string
	reportMu sync.RWMutex
	last Report
)

func main() {
	addr:=flag.String("addr","127.0.0.1:8443","TCP and UDP listen address")
	rounds:=flag.Int("rounds",20,"request rounds (1-200)")
	payload:=flag.Int("payload",4096,"payload bytes (1-1048576)")
	events:=flag.Int("events",20,"SSE events (1-500)")
	interval:=flag.Int("event-interval-ms",2,"interval between SSE events (0-1000ms)")
	flag.Parse()
	if *rounds<1||*rounds>200||*payload<1||*payload>1<<20||*events<1||*events>500||*interval<0||*interval>1000 { fatal(fmt.Errorf("invalid benchmark settings: rounds 1..200, payload 1..1048576, events 1..500, interval 0..1000")) }
	var err error
	root,err=os.Getwd(); if err!=nil {fatal(err)}
	cert,err:=makeCertificate(); if err!=nil {fatal(err)}
	tlsConfig:=&tls.Config{Certificates:[]tls.Certificate{cert},MinVersion:tls.VersionTLS13,NextProtos:[]string{"h2",http3.NextProtoH3}}
	mux:=http.NewServeMux()
	mux.HandleFunc("/",func(w http.ResponseWriter,r *http.Request){if r.URL.Path!="/" {http.NotFound(w,r);return};w.Header().Set("Cache-Control","no-store");http.ServeFile(w,r,filepath.Join(root,"dashboard.html"))})
	mux.HandleFunc("/api/results",resultsHandler)
	mux.HandleFunc("/api/sample",func(w http.ResponseWriter,r *http.Request){http.ServeFile(w,r,filepath.Join(root,"..","benchmark-sample.json"))})
	mux.HandleFunc("/bench/payload",func(w http.ResponseWriter,r *http.Request){n,_:=strconv.Atoi(r.URL.Query().Get("bytes"));if n<1{n=4096};if n>1<<20{n=1<<20};w.Header().Set("Content-Type","application/octet-stream");w.Header().Set("Cache-Control","no-store");_,_=w.Write(make([]byte,n))})
	mux.HandleFunc("/events",func(w http.ResponseWriter,r *http.Request){
		n,_:=strconv.Atoi(r.URL.Query().Get("count"));if n<1{n=20};if n>500{n=500}
		ms,_:=strconv.Atoi(r.URL.Query().Get("interval"));if ms<0{ms=0};if ms>1000{ms=1000}
		w.Header().Set("Content-Type","text/event-stream");w.Header().Set("Cache-Control","no-cache, no-transform");w.Header().Set("X-Accel-Buffering","no")
		f,ok:=w.(http.Flusher);if !ok {http.Error(w,"flush unavailable",500);return}
		for i:=0;i<n;i++ {if r.Context().Err()!=nil{return};fmt.Fprintf(w,"event: datastar-patch-elements
data: {"elements":"<span data-benchmark-seq=\"%d\">event %d</span>"}

",i,i);f.Flush();if ms>0{select{case <-r.Context().Done():return;case <-time.After(time.Duration(ms)*time.Millisecond):}}}
	})
	mux.HandleFunc("/api/benchmark",func(w http.ResponseWriter,r *http.Request){if r.Method!=http.MethodPost{http.Error(w,"POST required",405);return};cfg:=Settings{*rounds,*payload,*events,*interval};if err:=runBenchmark(r.Context(),*addr,cfg);err!=nil{http.Error(w,err.Error(),500);return};resultsHandler(w,r)})
	mux.HandleFunc("/datastar/benchmark",func(w http.ResponseWriter,r *http.Request){
		if r.Method!=http.MethodPost{http.Error(w,"POST required",405);return}
		w.Header().Set("Content-Type","text/event-stream");w.Header().Set("Cache-Control","no-cache, no-transform");w.Header().Set("X-Accel-Buffering","no")
		f,ok:=w.(http.Flusher);if !ok{return}
		patch(w,"Benchmark running","Measuring HTTP/2 and HTTP/3 using the same payload and SSE workload…");f.Flush()
		err:=runBenchmark(r.Context(),*addr,Settings{*rounds,*payload,*events,*interval})
		if err!=nil{patch(w,"Benchmark failed",err.Error());f.Flush();return}
		patch(w,"Benchmark complete","Measured JSON report saved. Dashboard is refreshing the charts.");f.Flush()
	})
	tcp,err:=net.Listen("tcp",*addr);if err!=nil{fatal(err)}
	udp,err:=net.ListenPacket("udp",*addr);if err!=nil{_ = tcp.Close();fatal(err)}
	httpServer:=&http.Server{Handler:mux,TLSConfig:tlsConfig,ReadHeaderTimeout:5*time.Second}
	h3Server:=&http3.Server{Handler:mux,TLSConfig:tlsConfig}
	go func(){if e:=httpServer.ServeTLS(tcp,"","");e!=nil&&e!=http.ErrServerClosed{fmt.Fprintln(os.Stderr,"HTTP server:",e)}}()
	go func(){if e:=h3Server.Serve(udp);e!=nil{fmt.Fprintln(os.Stderr,"HTTP/3 server:",e)}}()
	fmt.Printf("Dashboard: https://%s/ (TCP + UDP). Local self-signed certificate; test only.
",*addr)
	select{}
}
func fatal(e error){fmt.Fprintln(os.Stderr,e);os.Exit(1)}
func makeCertificate()(tls.Certificate,error){
	key,e:=rsa.GenerateKey(rand.Reader,2048);if e!=nil{return tls.Certificate{},e}
	t:=x509.Certificate{SerialNumber:big.NewInt(time.Now().UnixNano()),Subject:pkix.Name{CommonName:"localhost"},NotBefore:time.Now().Add(-time.Minute),NotAfter:time.Now().Add(24*time.Hour),KeyUsage:x509.KeyUsageDigitalSignature|x509.KeyUsageKeyEncipherment,ExtKeyUsage:[]x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},DNSNames:[]string{"localhost"},IPAddresses:[]net.IP{net.ParseIP("127.0.0.1")}}
	der,e:=x509.CreateCertificate(rand.Reader,&t,&t,&key.PublicKey,key);if e!=nil{return tls.Certificate{},e}
	cert:=pem.EncodeToMemory(&pem.Block{Type:"CERTIFICATE",Bytes:der});priv:=pem.EncodeToMemory(&pem.Block{Type:"RSA PRIVATE KEY",Bytes:x509.MarshalPKCS1PrivateKey(key)})
	return tls.X509KeyPair(cert,priv)
}
func patch(w io.Writer,title,detail string){html:=fmt.Sprintf("<div id="run-status" class="status-live"><strong>%s</strong><span>%s</span></div>",escape(title),escape(detail));html=strings.ReplaceAll(html,"\","\\");html=strings.ReplaceAll(html,"
","\n");fmt.Fprintf(w,"event: datastar-patch-elements
data: elements %s

",html)}
func escape(s string)string{r:=strings.NewReplacer("&","&amp;","<","&lt;",">","&gt;",""","&quot;","'","&#39;");return r.Replace(s)}
func resultsHandler(w http.ResponseWriter,r *http.Request){
	path:=filepath.Join(root,"..","benchmark-results.json")
	if b,e:=os.ReadFile(path);e==nil{w.Header().Set("Content-Type","application/json");w.Header().Set("Cache-Control","no-store");_,_=w.Write(b);return}
	w.Header().Set("Content-Type","application/json");reportMu.RLock();defer reportMu.RUnlock()
	if last.Mode!=""{_ = json.NewEncoder(w).Encode(last);return}
	http.ServeFile(w,r,filepath.Join(root,"..","benchmark-sample.json"))
}
func runBenchmark(ctx context.Context,addr string,s Settings)error{
	base:="https://"+addr
	h2t:=&http.Transport{TLSClientConfig:&tls.Config{InsecureSkipVerify:true,MinVersion:tls.VersionTLS13},ForceAttemptHTTP2:true};defer h2t.CloseIdleConnections()
	h3t:=&http3.Transport{TLSClientConfig:&tls.Config{InsecureSkipVerify:true,MinVersion:tls.VersionTLS13}};defer h3t.Close()
	h2,e:=measure(ctx,&http.Client{Transport:h2t,Timeout:20*time.Second},base,"HTTP/2 over TLS/TCP",2,s);if e!=nil{return fmt.Errorf("HTTP/2: %w",e)}
	h3,e:=measure(ctx,&http.Client{Transport:h3t,Timeout:20*time.Second},base,"HTTP/3 over QUIC/UDP",3,s);if e!=nil{return fmt.Errorf("HTTP/3: %w",e)}
	rep:=Report{SchemaVersion:1,GeneratedAt:time.Now().UTC(),Mode:"measured",Environment:map[string]any{"server":"Datastar HTTP/3 benchmark harness","payloadBytes":s.Payload,"rounds":s.Rounds,"sseEvents":s.Events,"sseIntervalMs":s.Interval,"note":"Measured locally. Repeat on target infrastructure before deployment decisions."},Results:map[string]Metrics{"http2":h2,"http3":h3}}
	rep.Comparison=map[string]any{"latencyP50ImprovementPercent":improve(h2.RequestLatencyMs.P50,h3.RequestLatencyMs.P50),"throughputImprovementPercent":improve(h2.ThroughputMbps,h3.ThroughputMbps),"sseTTFEImprovementPercent":improve(h2.SSE.TimeToFirstEventMs,h3.SSE.TimeToFirstEventMs),"interpretation":"This run describes this environment only; neither transport is universally faster."}
	b,e:=json.MarshalIndent(rep,"","  ");if e!=nil{return e}
	for _,name:=range []string{"benchmark-results.json","benchmark-sample.json"}{path:=filepath.Join(root,"..",name);if e=os.WriteFile(path,b,0644);e!=nil{return fmt.Errorf("write JSON report %s: %w",path,e)}}
	reportMu.Lock();last=rep;reportMu.Unlock();return nil
}
func measure(ctx context.Context,c *http.Client,base,label string,major int,s Settings)(Metrics,error){
	times:=make([]float64,0,s.Rounds);var bytes int64;started:=time.Now()
	for i:=0;i<s.Rounds;i++{
		reqCtx,cancel:=context.WithTimeout(ctx,10*time.Second);req,_:=http.NewRequestWithContext(reqCtx,"GET",fmt.Sprintf("%s/bench/payload?bytes=%d&i=%d",base,s.Payload,i),nil)
		t:=time.Now();resp,e:=c.Do(req);if e!=nil{cancel();return Metrics{},e}
		if resp.ProtoMajor!=major{resp.Body.Close();cancel();return Metrics{},fmt.Errorf("expected HTTP/%d, negotiated %s",major,resp.Proto)}
		n,e:=io.Copy(io.Discard,resp.Body);resp.Body.Close();cancel();if e!=nil{return Metrics{},e}
		times=append(times,float64(time.Since(t).Microseconds())/1000);bytes+=n
	}
	elapsed:=time.Since(started).Seconds();if elapsed<=0{elapsed=.000001}
	sse,e:=measureSSE(ctx,c,base,s.Events,s.Interval,major);if e!=nil{return Metrics{},e}
	return Metrics{Protocol:label,RequestLatencyMs:distribution(times),ThroughputMbps:round(float64(bytes)*8/elapsed/1e6),SSE:sse},nil
}
func measureSSE(ctx context.Context,c *http.Client,base string,count,interval,major int)(SSE,error){
	ctx,cancel:=context.WithTimeout(ctx,20*time.Second);defer cancel();start:=time.Now()
	req,_:=http.NewRequestWithContext(ctx,"GET",fmt.Sprintf("%s/events?count=%d&interval=%d",base,count,interval),nil)
	resp,e:=c.Do(req);if e!=nil{return SSE{},e};defer resp.Body.Close()
	if resp.ProtoMajor!=major{return SSE{},fmt.Errorf("SSE expected HTTP/%d, got %s",major,resp.Proto)}
	if !strings.HasPrefix(resp.Header.Get("Content-Type"),"text/event-stream"){return SSE{},fmt.Errorf("unexpected SSE content type %q",resp.Header.Get("Content-Type"))}
	reader:=bufio.NewReader(resp.Body);got:=0;first:=0.0
	for got<count{line,e:=reader.ReadString('
');if e!=nil{return SSE{},fmt.Errorf("SSE event %d/%d: %w",got,count,e)};if strings.HasPrefix(line,"data:"){if got==0{first=float64(time.Since(start).Microseconds())/1000};got++}}
	d:=time.Since(start);sec:=d.Seconds();if sec<=0{sec=.000001}
	return SSE{TimeToFirstEventMs:first,TotalDurationMs:float64(d.Microseconds())/1000,EventsPerSecond:round(float64(got)/sec),EventsReceived:got},nil
}
func distribution(v []float64)Distribution{
	if len(v)==0{return Distribution{}}
	x:=append([]float64(nil),v...);sort.Float64s(x);sum:=0.0;for _,n:=range x{sum+=n}
	p:=func(q float64)float64{i:=int(math.Ceil(q*float64(len(x))))-1;if i<0{i=0};if i>=len(x){i=len(x)-1};return x[i]}
	return Distribution{Min:round(x[0]),P50:round(p(.5)),P95:round(p(.95)),P99:round(p(.99)),Max:round(x[len(x)-1]),Mean:round(sum/float64(len(x)))}
}
func round(v float64)float64{return math.Round(v*100)/100}
func improve(base,actual float64)float64{if base<=0{return 0};return round((base-actual)/base*100)}
