import autocannon from 'autocannon';
import { randomUUID } from 'crypto';
import fs from 'node:fs';
import path from 'node:path';

function loadEnv(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env')
  ];
  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}
loadEnv();

const targetUrl = process.env.TARGET_URL || process.argv[2] || 'http://localhost:3000';
if (!targetUrl) {
  console.error('Please set TARGET_URL environment variable or provide URL as command-line argument');
  process.exit(1);
}

interface AdminStatus {
  currentTier: number;
  currentLoadScore: number;
  manualOverride: number | null;
  cooldownPeriodMs: number;
  switchHistory: Array<{
    timestamp: string;
    fromTier: number;
    toTier: number;
    loadScore: number;
    reason: string;
  }>;
}

async function getStatus(): Promise<AdminStatus> {
  const res = await fetch(`${targetUrl}/admin/status`);
  if (!res.ok) throw new Error(`Status check failed: ${res.statusText}`);
  return res.json() as Promise<AdminStatus>;
}

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

function runAutocannon(opts: autocannon.Options): Promise<autocannon.Result> {
  return new Promise((resolve, reject) => {
    autocannon(opts, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function main() {
  console.log(`Targeting Gearbox Cluster at: ${targetUrl}\n`);

  console.log('--- Probing Initial Status ---');
  const initial = await getStatus();
  console.log(`Current Tier: Tier-${initial.currentTier} | Load Score: ${initial.currentLoadScore}\n`);

  console.log('--- Fetching Sample Product for Orders ---');
  const sampleProductId = await getFirstProductId();
  console.log(`Sample Product ID: ${sampleProductId}\n`);

  console.log('========================================================');
  console.log('Phase 1: Low Read Traffic (5s @ 5 conns)');
  console.log('Expected: Tier 6 Baseline (Direct SQL, No Cache)');
  console.log('========================================================');
  await runAutocannon({
    url: `${targetUrl}/api/v1/products`,
    connections: 5,
    duration: 5
  });
  const afterPhase1 = await getStatus();
  console.log(`Result: Tier-${afterPhase1.currentTier} | Load Score: ${afterPhase1.currentLoadScore}\n`);

  console.log('========================================================');
  console.log('Phase 2: Heavy Read Traffic (10s @ 35 conns)');
  console.log('Expected: Upshift to Tier 5 (Redis Catalog Cache)');
  console.log('========================================================');
  await runAutocannon({
    url: `${targetUrl}/api/v1/products`,
    connections: 35,
    duration: 10
  });
  const afterPhase2 = await getStatus();
  console.log(`Result: Tier-${afterPhase2.currentTier} | Load Score: ${afterPhase2.currentLoadScore}\n`);

  console.log('========================================================');
  console.log('Phase 3: High-Cost Order Creation Surge (15s @ 25 conns)');
  console.log('Expected: Upshift to Tier 4 -> Tier 3 (Kafka Async) -> Tier 2/1');
  console.log('========================================================');
  await runAutocannon({
    url: `${targetUrl}/api/v1/orders`,
    method: 'POST',
    connections: 25,
    duration: 15,
    headers: {
      'content-type': 'application/json'
    },
    setupClient: (client) => {
      client.setHeaders({
        'idempotency-key': randomUUID(),
        'content-type': 'application/json'
      });
      client.setBody(
        JSON.stringify({
          customerEmail: `loadtest-${Math.floor(Math.random() * 10000)}@example.com`,
          items: [{ productId: sampleProductId, quantity: 1 }]
        })
      );
    }
  });
  const afterPhase3 = await getStatus();
  console.log(`Result: Tier-${afterPhase3.currentTier} | Load Score: ${afterPhase3.currentLoadScore}\n`);

  console.log('========================================================');
  console.log('Phase 4: Cooldown & Downshift (Observing decay)');
  console.log('Waiting for cooldown (18s)...');
  console.log('========================================================');
  for (let i = 1; i <= 6; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const status = await getStatus();
    console.log(`T+${i * 3}s: Tier-${status.currentTier} | Load Score: ${status.currentLoadScore}`);
  }

  console.log('\n========================================================');
  console.log('Final Tier Transition History:');
  console.log('========================================================');
  const finalStatus = await getStatus();
  console.table(
    finalStatus.switchHistory.map((s) => ({
      Timestamp: s.timestamp.substring(11, 19),
      'From Tier': `Tier-${s.fromTier}`,
      'To Tier': `Tier-${s.toTier}`,
      'Load Score': s.loadScore,
      Reason: s.reason
    }))
  );
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});

