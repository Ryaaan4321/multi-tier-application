import { getTargetUrl } from './env.js';
import { profileGetEndpointAcrossTiers } from './flamegraph.js';

const targetUrl = getTargetUrl();

profileGetEndpointAcrossTiers({
  title: 'Gearbox GET /api/v1/products End-to-End Flamegraph Profiler (Tiers 6 -> 1)',
  targetUrl,
  path: '/api/v1/products?page=1&limit=5',
  dbLeafPrefixes: ['[DB] product_findMany_', '[DB] product_count_', '[Cache] cache_get_products'],
  formatDetails: (json) => {
    const count = Array.isArray(json?.data?.data) ? json.data.data.length : 0;
    const total = json?.data?.pagination?.total ?? count;
    return `Products: ${count} (Total: ${total})`;
  }
}).catch((err) => {
  console.error('Flamegraph test failed:', err);
  process.exit(1);
});

