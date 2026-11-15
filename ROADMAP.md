# Gearbox Engineering Roadmap & Next Milestones

This document records the four architectural paths available for future iteration on the Gearbox cluster. Refer to this roadmap whenever prioritizing new features, operational hardening, or demonstration deliverables.

---

## Path 1: Grafana Observability Dashboard (Visual Showcase)

### Goal
Provide an immediate, visual real-time dashboard of cluster dynamics, suitable for portfolio demonstrations, architecture reviews, and operational monitoring.

### Deliverables
1. **Container Integration**:
   - Add a lightweight `grafana/grafana:latest` service to `docker-compose.yml` mapped to port `3001` (or local port forward).
   - Auto-provision Prometheus (`http://prometheus:9090`) as the default data source via YAML config (`provisioning/datasources/prometheus.yaml`).
2. **Dashboard Visualizations**:
   - **Tachometer / Gearbox Gauge**: Visual display of the active tier (`proxy_current_tier`), dynamically updating from Tier-6 down to Tier-1.
   - **Load Score vs. Thresholds**: Graph of `proxy_current_load_score` with static threshold lines indicating gear-shift trigger points.
   - **Traffic & Latency Heatmap**: p50, p95, and p99 request duration histograms (`proxy_request_duration_seconds`) split by upstream tier.
   - **Tier Transition Log**: Annotation timeline marking every occurrence of `proxy_tier_switches_total`.

### Value
Transforms raw Prometheus PromQL counters into an intuitive, high-impact demonstration of the proxy's adaptive shifting capabilities.

---

## Path 2: Resiliency & Circuit Breaker Chaos Testing

### Goal
Validate and benchmark the proxy's built-in failure recovery mechanisms when individual tier microservices crash or degrade under high concurrency.

### Deliverables
1. **Automated Fault Injection Harness**:
   - Script that pauses or introduces latency into a specific upstream service (e.g., `docker compose pause service-tier-6`).
2. **Verification of Upward Fallback**:
   - Measure client error rates during upstream failure to prove that the circuit breaker trips from closed to open.
   - Confirm incoming traffic automatically skips the degraded tier and forwards to the next tier without returning `502 Bad Gateway` to clients.
3. **Half-Open Probe & Recovery Validation**:
   - Unpause the service and verify that the circuit breaker enters the half-open state, validates consecutive probe requests, and cleanly resets back to normal.

### Value
Proves true zero-downtime microservice fault tolerance and validates the proxy's circuit breaker design under simulated production outages.

---

## Path 3: Deep Verification of Tier-3 (Kafka & Background Email Worker)

### Goal
Demonstrate asynchronous write offloading on higher tiers by evaluating the Kafka event pipeline and background worker decoupled from the HTTP critical path.

### Deliverables
1. **Kafka Broker & Topic Validation**:
   - Verify event publishing to `emails.dispatch` and `orders.events` during order creation on Tiers 3, 2, and 1.
2. **Worker Concurrency Profiling**:
   - Profile `gearbox-email-worker` consuming messages asynchronously.
   - Verify that slow mock email delivery (e.g., simulated 25ms-50ms network delay) does not block client response latency.
3. **Throughput Comparison Benchmark**:
   - Run Autocannon writes comparing Tier-6 (synchronous direct email execution) vs. Tier-3 (Kafka event offloading) to measure maximum sustained orders per second.

### Value
Validates the core distributed messaging architecture and quantifies the exact throughput improvement of decoupling slow I/O operations from transaction handlers.

---

## Path 4: Live Cluster Telemetry Frontend (Interactive UI)

### Goal
Provide a browser-based user interface that allows visitors or evaluators to send live traffic surges and observe instant proxy telemetry in real time.

### Deliverables
1. **Lightweight Dashboard Client**:
   - A single-page application (or lightweight Vite/React dashboard) that polls `/admin/status` or listens to a Server-Sent Events (SSE) feed.
2. **Interactive Controls**:
   - Sliders or buttons to trigger low, medium, and surge traffic levels directly from the browser.
   - Visual speedometer and real-time transition logs tracking current tier and sliding-window load score.
   - Manual override toggle allowing users to force specific tiers and inspect immediate response behaviors.

### Value
Creates an interactive, self-contained product experience that lets anyone interact with Gearbox without running CLI terminal scripts.
