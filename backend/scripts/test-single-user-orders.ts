import { randomUUID } from 'crypto';
import { getTargetUrl } from './env.js';

const targetUrl = getTargetUrl();

interface TierTestResult {
  TargetTier: string;
  ServedByTier: string;
  LatencyMs: number;
  StatusCode: number;
  OrderId: string;
  IdempotencyReplay: string;
  KeyFeature: string;
}

const TIER_FEATURES: Record<number, string> = {
  6: 'Baseline (Direct SQL, Direct Sync Email +25ms delay)',
  5: 'Redis Catalog Caching Active',
  4: 'Distributed Rate Limiting Active',
  3: 'Kafka Async Decoupled (Zero Email Latency Delay)',
  2: 'Postgres Read Replica Active + Kafka',
  1: 'Application Sharding (UUIDv7 Key Routing) + Kafka'
};

async function getFirstProductId(): Promise<string> {
  const res = await fetch(`${targetUrl}/api/v1/products?limit=1`);
  if (!res.ok) throw new Error(`Product lookup failed: ${res.statusText}`);
  const json: any = await res.json();
  const products = json?.data?.data || json?.data?.products || json?.products || json?.data || [];
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('No products found in database. Seed the database first.');
  }
  return products[0].id;
}

async function runTierOrderTest() {
  console.log(`========================================================================`);
  console.log(` Gearbox Single-User Order Verification Across All Tiers (6 -> 1)`);
  console.log(` Target Cluster: ${targetUrl}`);
  console.log(`========================================================================\n`);

  console.log('[Step 1] Fetching live product catalog to acquire a valid product ID...');
  const productId = await getFirstProductId();
  console.log(`[Success] Acquired sample product ID: ${productId}\n`);

  const results: TierTestResult[] = [];
  const tiers = [6, 5, 4, 3, 2, 1];

  for (const tier of tiers) {
    console.log(`--- Testing Tier-${tier}: ${TIER_FEATURES[tier]} ---`);
    const idempotencyKey = randomUUID();
    const orderPayload = {
      customerEmail: `single-user-tier${tier}@example.com`,
      items: [{ productId, quantity: 1 }]
    };

    // 1. Initial Order Creation
    const start = performance.now();
    const response = await fetch(`${targetUrl}/api/v1/orders`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
        'x-force-tier': String(tier)
      },
      body: JSON.stringify(orderPayload)
    });
    const latencyMs = Math.round(performance.now() - start);
    const servedBy = response.headers.get('x-served-by-tier') || 'Unknown';
    const timelineHeader = response.headers.get('x-trace-timeline');
    const json: any = await response.json();

    const orderId = json?.data?.id || json?.data?.order?.id || 'N/A';

    console.log(`  -> Status: ${response.status} | Served by: ${servedBy} | Latency: ${latencyMs}ms | OrderId: ${orderId}`);

    if (timelineHeader) {
      try {
        const spans: Array<{ name: string; durationMs: number }> = JSON.parse(timelineHeader);
        console.log(`     [Waterfall Flamegraph Breakdown]`);
        const maxBarLength = 20;
        for (const span of spans) {
          const pct = Math.min(1, span.durationMs / (latencyMs || 1));
          const filled = Math.max(1, Math.round(pct * maxBarLength));
          const bar = '█'.repeat(filled) + ' '.repeat(maxBarLength - filled);
          const isSyncDelay = span.name.includes('email_send') && span.durationMs >= 20;
          const note = isSyncDelay ? ' <-- [BLOCKING SYNC EMAIL DELAY]' : '';
          const padName = span.name.padEnd(38, ' ');
          console.log(`       ${padName} |${bar}| ${span.durationMs.toFixed(1).padStart(5)}ms${note}`);
        }
      } catch {}
    }

    // 2. Test Idempotency Replay
    let idempotencyStatus = 'FAIL';
    try {
      const replayRes = await fetch(`${targetUrl}/api/v1/orders`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': idempotencyKey,
          'x-force-tier': String(tier)
        },
        body: JSON.stringify(orderPayload)
      });
      const replayJson: any = await replayRes.json();
      if (replayRes.status === 200 && (replayJson?.isReplay === true || replayJson?.data?.isReplay === true || replayJson?.data?.id === orderId)) {
        idempotencyStatus = 'PASS (Cached/Replay)';
      }
    } catch {
      idempotencyStatus = 'ERROR';
    }

    console.log(`  -> Status: ${response.status} | Served by: ${servedBy} | Latency: ${latencyMs}ms | OrderId: ${orderId}`);
    console.log(`  -> Idempotency Replay Check: ${idempotencyStatus}\n`);

    results.push({
      TargetTier: `Tier-${tier}`,
      ServedByTier: servedBy,
      LatencyMs: latencyMs,
      StatusCode: response.status,
      OrderId: orderId.slice(0, 18) + '...',
      IdempotencyReplay: idempotencyStatus,
      KeyFeature: TIER_FEATURES[tier]
    });
  }

  console.log(`========================================================================`);
  console.log(` Summary Comparison Table Across All 6 Tiers`);
  console.log(`========================================================================`);
  console.table(results);
}

runTierOrderTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

