import { randomUUID } from 'node:crypto';
import { targetUrl, parseCommonArgs, runAutocannonWorkflow } from './autocannon-common.js';

async function getSampleOrderId(): Promise<string> {
  const res = await fetch(`${targetUrl}/api/v1/orders?limit=1`);
  if (res.ok) {
    const json: any = await res.json();
    const orders = json?.data?.orders || json?.orders || [];
    if (Array.isArray(orders) && orders.length > 0) {
      return orders[0].id;
    }
  }

  /* Self-healing fallback: If no orders exist, fetch a product and create one */
  const prodRes = await fetch(`${targetUrl}/api/v1/products?limit=1`);
  const prodJson: any = await prodRes.json();
  const products = prodJson?.data?.data || prodJson?.data?.products || prodJson?.products || [];
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('Database product catalog is empty. Please seed products first.');
  }
  const createRes = await fetch(`${targetUrl}/api/v1/orders`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': randomUUID()
    },
    body: JSON.stringify({
      customerEmail: `self-heal-${Date.now()}@example.com`,
      items: [{ productId: products[0].id, quantity: 1 }]
    })
  });
  const createJson: any = await createRes.json();
  return createJson.data.id;
}
async function main() {
  const { isSingle } = parseCommonArgs();
  let path = '/api/v1/orders?page=1&limit=10';
  let routeLabel = 'GET /api/v1/orders (List Pagination, Cost: 5)';
  if (isSingle) {
    const orderId = await getSampleOrderId();
    path = `/api/v1/orders/${orderId}`;
    routeLabel = 'GET /api/v1/orders/:id (Replica Routing & Redis Cache, Cost: 3)';
  }
  await runAutocannonWorkflow({
    routeLabel,
    path,
    method: 'GET'
  });
}

main().catch((err) => {
  console.error('Autocannon GET orders surge failed:', err);
  process.exit(1);
});
