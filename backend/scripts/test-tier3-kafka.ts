import { randomUUID } from 'node:crypto';
import { getTargetUrl } from './env.js';

const targetUrl = getTargetUrl();

interface OrderBenchResult {
  tier: number;
  mode: string;
  orderId: string;
  totalClientMs: number;
  proxyUpstreamMs: number;
  proxyOverheadMs: number;
  traceSpans: string[];
}

async function getFirstProductId(): Promise<string> {
  const res = await fetch(`${targetUrl}/api/v1/products?limit=1`);
  if (!res.ok) {
    throw new Error(`Failed to fetch sample product: ${res.statusText}`);
  }
  const json: any = await res.json();
  const products = json?.data?.data || json?.data?.products || json?.products || json?.data || [];
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('No products found in database. Seed the database first.');
  }
  return products[0].id;
}
async function placeOrderOnTier(tier: number, productId: string, index: number): Promise<OrderBenchResult> {
  const idempotencyKey = randomUUID();
  const email = `kafka-bench-tier${tier}-${index}-${Date.now()}@example.com`;
  const body = JSON.stringify({
    customerEmail: email,
    items: [{ productId, quantity: 1 }]
  });
  const start = performance.now();
  const res = await fetch(`${targetUrl}/api/v1/orders`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
      'x-force-tier': String(tier)
    },
    body
  });

  const totalClientMs = Math.round(performance.now() - start);
  const json: any = await res.json();
  if (!res.ok) {
    throw new Error(`Order failed on Tier-${tier}: ${res.status} ${JSON.stringify(json)}`);
  }
  const orderId = json?.data?.id || json?.data?.order?.id || 'unknown';
  const proxyUpstreamMs = Number(res.headers.get('x-proxy-upstream-ms') || 0);
  const proxyOverheadMs = Number(res.headers.get('x-proxy-overhead-ms') || 0);
  const rawTimeline = res.headers.get('x-trace-timeline');
  let traceSpans: string[] = [];
  if (rawTimeline) {
    try {
      const parsed = JSON.parse(rawTimeline);
      if (Array.isArray(parsed)) {
        traceSpans = parsed.map((s: any) => `${s.name} (${s.durationMs}ms)`);
      }
    } catch {
    }
  }
  return {
    tier,
    mode: tier <= 3 ? 'Kafka Async Dispatch' : 'Direct Sync In-Process',
    orderId,
    totalClientMs,
    proxyUpstreamMs,
    proxyOverheadMs,
    traceSpans
  };
}

async function runKafkaVerification() {
  console.log('========================================================================');
  console.log(' Gearbox Tier-3 Kafka Async Event Queue & Worker Verification');
  console.log(` Target Cluster: ${targetUrl}`);
  console.log('========================================================================\n');
  console.log('[Step 1] Fetching live product catalog to acquire a valid product ID...');
  const productId = await getFirstProductId();
  console.log(`[Success] Sample Product ID: ${productId}\n`);
  console.log('[Step 2] Sending baseline write to Tier-6 (Direct SQL + Synchronous In-Process Email)...');
  const tier6Result = await placeOrderOnTier(6, productId, 1);
  console.log(` Tier-6 Order ID: ${tier6Result.orderId}`);
  console.log(` Client Latency: ${tier6Result.totalClientMs}ms | Upstream Service: ${tier6Result.proxyUpstreamMs}ms`);
  console.log(` Execution Spans: ${tier6Result.traceSpans.join(', ') || 'N/A'}\n`);
  console.log('[Step 3] Sending write to Tier-3 (Kafka Decoupled Queue + Async Background Worker)...');
  const tier3Result = await placeOrderOnTier(3, productId, 1);
  console.log(` Tier-3 Order ID: ${tier3Result.orderId}`);
  console.log(` Client Latency: ${tier3Result.totalClientMs}ms | Upstream Service: ${tier3Result.proxyUpstreamMs}ms`);
  console.log(` Execution Spans: ${tier3Result.traceSpans.join(', ') || 'N/A'}\n`);
  console.log('[Step 4] Running Concurrent Burst Test (10 orders each: Tier-6 vs Tier-3)...');
  console.log(' Executing 10 concurrent orders on Tier-6...');
  const startT6 = performance.now();
  const t6Promises = Array.from({ length: 10 }, (_, i) => placeOrderOnTier(6, productId, i + 10));
  const t6Burst = await Promise.all(t6Promises);
  const totalT6Time = Math.round(performance.now() - startT6);
  const avgT6Latency = Math.round(t6Burst.reduce((acc, r) => acc + r.totalClientMs, 0) / t6Burst.length);
  console.log(' Executing 10 concurrent orders on Tier-3...');
  const startT3 = performance.now();
  const t3Promises = Array.from({ length: 10 }, (_, i) => placeOrderOnTier(3, productId, i + 10));
  const t3Burst = await Promise.all(t3Promises);
  const totalT3Time = Math.round(performance.now() - startT3);
  const avgT3Latency = Math.round(t3Burst.reduce((acc, r) => acc + r.totalClientMs, 0) / t3Burst.length);
  console.log('\n========================================================================');
  console.log(' Concurrency Benchmark Summary (Burst of 10 Concurrent Orders)');
  console.log('========================================================================');
  console.table([
    {
      Tier: 'Tier-6',
      Architecture: 'Single Node, Synchronous In-Process Email',
      'Total Batch Duration': `${totalT6Time}ms`,
      'Avg Request Latency': `${avgT6Latency}ms`,
      'Kafka Queuing': 'Inactive'
    },
    {
      Tier: 'Tier-3',
      Architecture: 'Rate-Limited + Kafka Asynchronous Event Queue',
      'Total Batch Duration': `${totalT3Time}ms`,
      'Avg Request Latency': `${avgT3Latency}ms`,
      'Kafka Queuing': 'Active (Offloaded to Worker)'
    }
  ]);
  console.log('\n[Step 5] Worker Processing Verification');
  console.log('The orders placed on Tier-3 were published to topic "emails.dispatch".');
  console.log('To watch the background worker consume and process these jobs, run this on EC2:');
  console.log('  docker compose logs --tail 25 gearbox-email-worker\n');
  console.log(`Last Dispatched Tier-3 Order ID for verification: ${tier3Result.orderId}`);
  console.log('========================================================================\n');
}
runKafkaVerification().catch((err) => {
  console.error('Tier-3 Kafka Verification failed:', err);
  process.exit(1);
});
