import { getTargetUrl } from './env.js';
import { profileGetEndpointAcrossTiers } from './flamegraph.js';

const targetUrl = getTargetUrl();

profileGetEndpointAcrossTiers({
  title: 'Gearbox GET /api/v1/orders End-to-End Flamegraph Profiler (Tiers 6 -> 1)',
  targetUrl,
  path: '/api/v1/orders?page=1&limit=5',
  dbLeafPrefixes: ['[DB] findAll_'],
  formatDetails: (json) => {
    const count = Array.isArray(json?.data?.orders) ? json.data.orders.length : 0;
    return `Orders: ${count}`;
  }
}).catch((err) => {
  console.error('Flamegraph test failed:', err);
  process.exit(1);
});
