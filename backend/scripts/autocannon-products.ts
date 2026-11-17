import { targetUrl, parseCommonArgs, runAutocannonWorkflow } from './autocannon-common.js';

async function getSampleProductId(): Promise<string> {
  const res = await fetch(`${targetUrl}/api/v1/products?limit=1`);
  if (!res.ok) throw new Error(`Failed to fetch product catalog: ${res.statusText}`);
  const json: any = await res.json();
  const products = json?.data?.data || json?.data?.products || json?.products || [];
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('Database product catalog is empty. Please seed products first.');
  }
  return products[0].id;
}

async function main() {
  const { isSingle } = parseCommonArgs();
  let path = '/api/v1/products?page=1&limit=10';
  let routeLabel = 'GET /api/v1/products (Catalog Pagination, Cost: 1)';
  if (isSingle) {
    const productId = await getSampleProductId();
    path = `/api/v1/products/${productId}`;
    routeLabel = 'GET /api/v1/products/:id (Single Item Redis Cache, Cost: 3)';
  }
  await runAutocannonWorkflow({
    routeLabel,
    path,
    method: 'GET'
  });
}
main().catch((err) => {
  console.error('Autocannon GET products surge failed:', err);
  process.exit(1);
});
