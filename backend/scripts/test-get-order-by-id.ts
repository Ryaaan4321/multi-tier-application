import { getTargetUrl } from './env.js';
import { profileGetEndpointAcrossTiers, resolveResourceId } from './flamegraph.js';

const targetUrl = getTargetUrl();

async function run() {
  const orderId = await resolveResourceId(
    targetUrl,
    '/api/v1/orders?page=1&limit=1',
    (json) => json?.data?.orders || [],
    'Order'
  );
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
