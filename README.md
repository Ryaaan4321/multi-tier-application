# Gearbox

An adaptive, load-aware reverse proxy and multi-tiered microservice architecture.

---

## Overview

Gearbox sits in front of multiple service tiers running in Docker containers. Every tier solves the exact same problem and implements the exact same API contract, but each tier is provisioned and architected at a different scale.

The proxy continuously measures real-time traffic using a weighted load score and dynamically routes new incoming requests to the tier sized for that load. When load increases, traffic transitions to higher-capacity tiers. When load subsides, traffic moves back down.

This design demonstrates scaling to fit load rather than feature degradation. Low-tier environments avoid the resource overhead of distributed brokers and sharded clusters, while high-tier environments activate sharding, caching, and asynchronous streaming when traffic demands it.

---

## Architecture

```
                       +-------------------------+
                       |      Client Traffic     |
                       +------------+------------+
                                    |
                                    v
                       +-------------------------+
                       |    Gearbox Reverse      |
                       |         Proxy           |
                       | (Load Monitor + Router) |
                       +------------+------------+
                                    |
            +-----------------------+-----------------------+
            |                       |                       |
            v                       v                       v
     +--------------+        +--------------+        +--------------+
     |    Tier 6    |        |    Tier 5    |        |  Tiers 4..1  |
     | (Single Node |        | (Redis Cache |        | (Sharded DB, |
     |  Direct SQL) |        |  Replicas)   |        |  Kafka, etc) |
     +-------+------+        +-------+------+        +-------+------+
             |                       |                       |
             +-----------------------+-----------------------+
                                     |
                                     v
                        +-------------------------+
                        |    Shared Data Layer    |
                        |   (PostgreSQL/Neon)     |
                        +-------------------------+
```

---

## Service Tiers

| Tier | Characteristics | Primary Use Case |
| :--- | :--- | :--- |
| **Tier 6** | Single server instance, direct PostgreSQL queries, synchronous email, no cache | Low baseline traffic |
| **Tier 5** | Tier 6 plus Redis read caching for product catalog | Read-heavy moderate load |
| **Tier 4** | Tier 5 plus rate limiting (`@fastify/rate-limit`) and multiple server replicas | Burst traffic prevention |
| **Tier 3** | Tier 4 plus Kafka event streaming and background email workers | Asynchronous write scaling |
| **Tier 2** | Tier 3 plus read replicas and designated read routing | High concurrency scaling |
| **Tier 1** | Application-level database sharding, full caching, multi-partition Kafka | Peak enterprise throughput |

---

## Load Calculation and Dynamic Tier Routing

1. **Route-to-Cost Mapping:** Raw request counts are insufficient because writes, email triggers, and cache misses have different computational weights:
   - `GET /api/v1/products`: 1 unit (cacheable catalog read)
   - `GET /api/v1/products/:id`: 3 units (specific lookup)
   - `POST /api/v1/orders`: 15 units (write transaction, stock decrement, email, event emit)
   - `/health` and `/ready`: 0 units (excluded from calculation)

2. **Bucketed Sliding Window:** The proxy tracks costs using a fixed-size ring buffer of 1-second buckets over a 10-second rolling window. This provides $O(1)$ constant-memory metrics without garbage collection pauses.

3. **Pure Function Tier Selection:** The tier selector evaluates the load score using independent up and down thresholds (hysteresis) and an enforced cooldown window to eliminate rapid tier flapping:
   - Tier 6 $\to$ Tier 5: Load $\ge 250$
   - Tier 5 $\to$ Tier 4: Load $\ge 500$
   - Tier 4 $\to$ Tier 3: Load $\ge 1,000$
   - Tier 3 $\to$ Tier 2: Load $\ge 2,000$
   - Tier 2 $\to$ Tier 1: Load $\ge 4,000$

4. **Connection Pooling & Resiliency:** The proxy uses `undici` with persistent HTTP keep-alive connection pools. Each tier is monitored by an upstream circuit breaker (`TierCircuitBreaker`) with automatic upward fallback to higher tiers upon error spikes.

---

## Observability & Live Telemetry

### 1. Zero-Cost Prometheus & Grafana Stack
The cluster includes a pre-provisioned, memory-capped observability stack deployed via Docker Compose:
- **Prometheus (`port 9090`):** 5-second scrape interval with a 512MB/24h TSDB retention cap.
- **Grafana (`port 3001`):** Auto-provisions the Prometheus data source and automatically loads the **Gearbox Cluster Overview** dashboard on boot with Anonymous Viewer access enabled.

### 2. Live Dashboard Metrics
- **Tachometer / Gearbox Radial Gauge:** Real-time visual indicator of the active gear (Tier-6 down to Tier-1).
- **Rolling Load Score Timeline:** Real-time EWMA traffic weight charted against static gear-shift threshold lines.
- **Cluster Throughput (RPS):** Current requests per second.
- **Latency Percentiles (p50 / p95 / p99):** Real-time latency curves proving response times stay flat during surges.
- **Traffic by Serving Tier:** Stacked area graph showing which tier handled the requests.

### 3. Sub-Operation Telemetry & ASCII Flamegraphs
The proxy and services emit fine-grained timing headers on every request:
- `x-proxy-overhead-ms`: Routing, EWMA calculation, and connection pool scheduling duration.
- `x-proxy-upstream-ms`: Network round-trip waiting on the upstream tier.
- `x-proxy-total-ms`: Total proxy processing time.
- `x-trace-timeline`: Chronologically ordered sub-operation spans capturing rate limiter overhead, individual database query execution per shard, and serialization.

---

## Performance Benchmarks

Following database query optimizations, atomic stock decrement transactions, and cache-aside implementation:

| Metric / Route | Baseline (Pre-Optimization) | Optimized (Current) | Improvement |
| :--- | :--- | :--- | :--- |
| **`POST /api/v1/orders`** | $11,531\text{ ms}$ | $< 950\text{ ms}$ | **~92% faster** |
| **`GET /api/v1/orders/:id` (Cached)** | $884\text{ ms}$ | $1.5\text{ ms}$ | **~99.8% faster** |
| **`GET /api/v1/products`** | $1,355\text{ ms}$ | $509\text{ ms}$ | **~62% faster** |
| **Cluster Median Latency (p50)** | $> 2,000\text{ ms}$ | **$24.0\text{ ms}$** | **Sub-50ms baseline** |

---

## Technology Stack

- **Runtime & Language:** Node.js with TypeScript
- **Web Framework:** Fastify
- **Database & ORM:** PostgreSQL (Neon Serverless & local containers) with Prisma (utilizing RFC 9562 UUIDv7 for time-ordered primary keys)
- **Caching:** Redis Cloud & local Redis
- **Message Broker:** Kafka (Redpanda in local development)
- **Observability:** Prometheus & Grafana (custom provisioned dashboards)
- **Metrics & Logging:** Pino (structured JSON) and `prom-client` (p50/p95/p99 latency histograms)
- **Benchmarking & Testing:** Autocannon scripted load tests and custom ASCII flamegraph profilers
- **Containerization:** Docker Compose with explicit CPU and memory resource bounds (`mem_limit: 256m`)

---

## Directory Structure

```text
gearbox/
├── docker-compose.yml       # 13-container orchestration (Proxy, Tiers 1-6, DBs, Prometheus, Grafana)
├── prometheus.yml           # Prometheus scrape configuration (5s interval)
├── ROADMAP.md               # Architecture roadmap and future engineering milestones
├── grafana/
│   ├── dashboards/
│   │   └── gearbox-overview.json            # Curated Gearbox Cluster Overview dashboard
│   └── provisioning/
│       ├── dashboards/dashboards.yaml        # Automatic dashboard provider configuration
│       └── datasources/prometheus.yaml      # Automatic Prometheus datasource provisioning
└── backend/
    ├── package.json         # Workspace root and test script definitions
    ├── proxy/
    │   ├── src/
    │   │   ├── config/      # Typed environment validation
    │   │   ├── engine/      # Sliding window, cost map, tier selection logic
    │   │   ├── forwarder/   # Undici connection pools and circuit breakers
    │   │   ├── health/      # Tier health and readiness probes
    │   │   ├── telemetry/   # Prometheus metrics
    │   │   ├── app.ts       # Fastify proxy application definition
    │   │   └── server.ts    # Entry point and graceful shutdown
    │   └── tests/           # Pure function unit tests (17/17 passing)
    ├── scripts/
    │   ├── env.ts           # Dynamic environment loader supporting TARGET_URL
    │   ├── flamegraph.ts    # Reusable ASCII waterfall flamegraph renderer
    │   ├── load-test.ts     # Multi-phase Autocannon dynamic load benchmark
    │   ├── test-get-orders.ts
    │   ├── test-get-order-by-id.ts
    │   ├── test-get-products.ts
    │   ├── test-get-product-by-id.ts
    │   └── test-single-user-orders.ts
    └── service/
        ├── prisma/          # Prisma schema and migrations
        └── src/
            ├── config/      # Tier-aware environment config
            ├── controllers/ # HTTP request handling
            ├── infra/       # DB router, cache, email, and event adapters
            ├── middlewares/ # Request ID, error handler, rate limit hooks
            ├── models/      # Domain entities and DTOs
            ├── repositories/# Database query layer
            ├── routes/v1/   # API endpoints
            ├── services/    # Business logic and transactions
            ├── telemetry/   # Timeline context and latency metrics
            ├── container.ts # Dependency injection composition root
            └── app.ts       # Fastify service configuration
```

---

## Getting Started

### 1. Start the Cluster
```bash
docker compose up -d
```

### 2. Access Dashboards via Encrypted SSH Tunnel
Because cloud firewall ports are restricted by default, forward the local ports over SSH:
```bash
ssh -i ~/.ssh/gearbox.pem -L 3001:localhost:3001 -L 9090:localhost:9090 -L 3000:localhost:3000 ubuntu@<EC2_PUBLIC_IP>
```

Open in your browser:
- **Grafana Live Dashboard:** `http://localhost:3001`
- **Prometheus UI:** `http://localhost:9090`
- **Reverse Proxy Admin Status:** `http://localhost:3000/admin/status`

### 3. Run the Autocannon Load Benchmark
To watch the cluster dynamically shift gears from Tier 6 $\to$ Tier 1 in real time:
```bash
cd backend
npx tsx scripts/load-test.ts
```

### 4. Run Sub-Operation Flamegraph Profilers
```bash
cd backend
npx tsx scripts/test-get-orders.ts
npx tsx scripts/test-get-order-by-id.ts
npx tsx scripts/test-get-products.ts
npx tsx scripts/test-get-product-by-id.ts
npx tsx scripts/test-single-user-orders.ts
```

