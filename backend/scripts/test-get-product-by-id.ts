import { getTargetUrl } from './env.js';
import { profileGetEndpointAcrossTiers, resolveResourceId } from './flamegraph.js';

const targetUrl = getTargetUrl();

async function run() {
  const productId = await resolveResourceId(
    targetUrl,
    '/api/v1/products?page=1&limit=1',
    (json) => json?.data?.data || json?.data?.products || [],
    'Product'
  );
  await profileGetEndpointAcrossTiers({
    title: 'Gearbox GET /api/v1/products/:id End-to-End Flamegraph Profiler (Tiers 6 -> 1)',
    targetUrl,
    path: `/api/v1/products/${productId}`,
    dbLeafPrefixes: ['[DB] product_findById_', '[Cache] cache_get_product_by_id'],
    formatDetails: (json, status) => {
      if (status !== 200 || !json?.data) return 'Not Found';
      return `${json.data.name || 'Product'} (Stock: ${json.data.stockQuantity ?? '?'})`;
    }
  });
}

run().catch((err) => {
  console.error('Flamegraph test failed:', err);
  process.exit(1);
});

