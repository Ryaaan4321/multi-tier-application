import { randomUUID } from 'node:crypto';
import { targetUrl, runAutocannonWorkflow } from './autocannon-common.js';

async function getSampleProductId(): Promise<string> {
  const res = await fetch(`${targetUrl}/api/v1/products?limit=1`);
  if (!res.ok) throw new Error(`Failed to fetch product catalog: ${res.statusText}`);
  const json: any = await res.json();
  const products = json?.data?.data || json?.data?.products || json?.products || json?.data || [];
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('Database product catalog is empty. Please seed products first.');
  }
  return products[0].id;
}

async function main() {
  const productId = await getSampleProductId();
  await runAutocannonWorkflow({
    routeLabel: 'POST /api/v1/orders (Weight: 15 cost units/req)',
    path: '/api/v1/orders',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    setupClient: (client) => {
      client.setHeaders({
        'content-type': 'application/json',
        'idempotency-key': randomUUID()
      });
      client.setBody(
        JSON.stringify({
          customerEmail: `surge-${Math.floor(Math.random() * 1000000)}@example.com`,
          items: [{ productId, quantity: 1 }]
        })
      );
    }
  });
}

main().catch((err) => {
  console.error('Autocannon orders surge failed:', err);
  process.exit(1);
});
