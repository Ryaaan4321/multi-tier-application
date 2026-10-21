# Gearbox

An adaptive, load-aware reverse proxy and multi-tiered microservice architecture.

## Overview

Gearbox sits in front of multiple service tiers running in Docker containers. Every tier solves the exact same problem and implements the exact same API contract, but each tier is provisioned and architected at a different scale.

The proxy continuously measures real-time traffic using a weighted load score and dynamically routes new incoming requests to the tier sized for that load. When load increases, traffic transitions to higher-capacity tiers. When load subsides, traffic moves back down.

This design demonstrates scaling to fit load rather than feature degradation. Low-tier environments avoid the resource overhead of distributed brokers and sharded clusters, while high-tier environments activate sharding, caching, and asynchronous streaming when traffic demands it.

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

## Service Tiers

| Tier | Characteristics | Primary Use Case |
| :--- | :--- | :--- |
| **Tier 6** | Single server instance, direct PostgreSQL queries, synchronous email, no cache | Low baseline traffic |
| **Tier 5** | Tier 6 plus Redis read caching for product catalog | Read-heavy moderate load |
| **Tier 4** | Tier 5 plus rate limiting and multiple server replicas | Burst traffic prevention |
| **Tier 3** | Tier 4 plus Kafka event streaming and background email workers | Asynchronous write scaling |
| **Tier 2** | Tier 3 plus read replicas and increased container resource limits | High concurrency scaling |
| **Tier 1** | Application-level database sharding, full caching, multi-partition Kafka | Peak enterprise throughput |

## Load Calculation and Tier Routing

1. **Route-to-Cost Mapping:** Raw request counts are insufficient because writes, email triggers, and cache misses have different costs. Each route is assigned a weighted cost score:
   - `GET /api/v1/products`: 1 unit (cacheable read)
   - `GET /api/v1/products/:id`: 3 units (specific query)
   - `POST /api/v1/orders`: 15 units (write, stock decrement, email, event emit)
   - `/health` and `/ready`: 0 units (excluded from calculation)

2. **Bucketed Sliding Window:** The proxy tracks costs using a fixed-size ring buffer of 1-second buckets over a 10-second rolling window. This provides $O(1)$ constant-memory metrics without garbage collection pauses.

3. **Pure Function Tier Selection:** The tier selector evaluates the load score using independent up and down thresholds (hysteresis) and an enforced cooldown window to eliminate rapid tier flapping.

4. **Connection Pooling & Resiliency:** The proxy uses `undici` with persistent HTTP keep-alive pools. Each tier is monitored by an upstream circuit breaker with upward fallback to higher tiers upon error spikes.

## Technology Stack

- **Runtime & Language:** Node.js with TypeScript
- **Web Framework:** Fastify
- **Database & ORM:** PostgreSQL with Prisma (utilizing RFC 9562 UUIDv7 for time-ordered primary keys)
- **Caching:** Redis
- **Message Broker:** Kafka (Redpanda in local development)
- **Logging & Metrics:** Pino (structured JSON) and `prom-client` (p50/p95/p99 latency histograms)
- **Benchmarking:** Autocannon scripted load tests
- **Containerization:** Docker and Docker Compose with explicit CPU and memory resource bounds

## Directory Structure

```text
backend/
├── proxy/
│   ├── src/
│   │   ├── config/          # Typed environment validation
│   │   ├── engine/          # Sliding window, cost map, tier selection logic
│   │   ├── forwarder/       # Undici connection pools and circuit breakers
│   │   ├── health/          # Tier health and readiness probes
│   │   ├── telemetry/       # Prometheus metrics
│   │   ├── app.ts           # Fastify proxy application definition
│   │   └── server.ts        # Entry point and graceful shutdown
│   └── tests/               # Pure function unit tests
├── service/
│   ├── prisma/              # Prisma schema and migrations
│   ├── src/
│   │   ├── config/          # Tier-aware environment config
│   │   ├── controllers/     # HTTP request handling
│   │   ├── errors/          # Custom application errors
│   │   ├── infra/           # DB router, cache, email, and event adapters
│   │   ├── middlewares/     # Request ID, error handler, tier headers
│   │   ├── models/          # Domain entities and DTOs
│   │   ├── repositories/    # Database query layer
│   │   ├── routes/v1/       # API endpoints
│   │   ├── services/        # Business logic and transactions
│   │   ├── telemetry/       # Latency histograms
│   │   ├── validators/      # Zod request validation
│   │   ├── container.ts     # Dependency injection composition root
│   │   ├── app.ts           # Service application setup
│   │   └── server.ts        # Server entry point
│   └── tests/
└── docker-compose.yml       # Container orchestration per tier
```

## License

MIT
