import { getTargetUrl } from './env.js';
import { profileGetEndpointAcrossTiers } from './flamegraph.js';

const targetUrl = getTargetUrl();

async function resolveOrderId(): Promise<string> {
  const argId = process.argv[2];
  if (argId && !argId.startsWith('http')) {
    return argId;
  }

  console.log('[Step 1] Fetching an existing order ID from GET /api/v1/orders?page=1&limit=1...');
  const res = await fetch(`${targetUrl}/api/v1/orders?page=1&limit=1`, {
    headers: { 'x-force-tier': '6' }
  });
  if (!res.ok) {
    throw new Error(`Order list lookup failed: ${res.status} ${res.statusText}`);
  }
  const json: any = await res.json();
  const orders = json?.data?.orders || [];
  if (!Array.isArray(orders) || orders.length === 0) {
    throw new Error('No orders found in database. Create one with `npm run test:orders` first.');
  }
  const orderId = orders[0].id;
  console.log(`[Success] Using Order ID: ${orderId}\n`);
  return orderId;
}

async function run() {
  const orderId = await resolveOrderId();
  await profileGetEndpointAcrossTiers({
    title: 'Gearbox GET /api/v1/orders/:id End-to-End Flamegraph Profiler (Tiers 6 -> 1)',
    targetUrl,
    path: `/api/v1/orders/${orderId}`,
    dbLeafPrefixes: ['[DB] findById_'],
    formatDetails: (json, status) => {
      if (status !== 200 || !json?.data) return 'Not Found';
      const itemCount = Array.isArray(json.data.items) ? json.data.items.length : 0;
      return `Status: ${json.data.status || 'OK'}, Items: ${itemCount}`;
    }
  });
}

run().catch((err) => {
  console.error('Flamegraph test failed:', err);
  process.exit(1);
});

