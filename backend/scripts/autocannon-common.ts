import autocannon from 'autocannon';
import { getTargetUrl } from './env.js';

export const targetUrl = getTargetUrl();
export const MAX_SAFE_CONNECTIONS = 25;
export const MAX_SAFE_AMOUNT = 5000;

export interface CommonArgs {
  amount: number;
  connections: number;
  isJson: boolean;
  isSingle: boolean;
}

export interface AdminStatus {
  currentTier: number;
  currentLoadScore: number;
  manualOverride: number | null;
  cooldownPeriodMs: number;
}

export interface AutocannonWorkflowOptions {
  routeLabel: string;
  path: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  setupClient?: (client: autocannon.Client) => void;
  defaultAmount?: number;
  defaultConnections?: number;
}

export function parseCommonArgs(defaultAmount = 71, defaultConnections = 5): CommonArgs {
  const args = process.argv.slice(2);
  let amount = defaultAmount;
  let connections = defaultConnections;
  let isJson = false;
  let isSingle = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--amount' || arg === '-a') {
      const val = parseInt(args[++i], 10);
      if (!isNaN(val)) amount = val;
    } else if (arg === '--connections' || arg === '-c') {
      const val = parseInt(args[++i], 10);
      if (!isNaN(val)) connections = val;
    } else if (arg === '--json') {
      isJson = true;
    } else if (arg === '--single' || arg === '-s') {
      isSingle = true;
    }
  }
  if (connections > MAX_SAFE_CONNECTIONS) {
    if (!isJson) {
      console.warn(`[Guardrail] Clamping connections from ${connections} down to ${MAX_SAFE_CONNECTIONS} to protect EC2.`);
    }
    connections = MAX_SAFE_CONNECTIONS;
  }
  if (amount > MAX_SAFE_AMOUNT) {
    amount = MAX_SAFE_AMOUNT;
  }

  return { amount, connections, isJson, isSingle };
}

export async function getAdminStatus(): Promise<AdminStatus> {
  const res = await fetch(`${targetUrl}/admin/status`);
  if (!res.ok) {
    throw new Error(`Status check failed: ${res.statusText}`);
  }
  return (await res.json()) as AdminStatus;
}

export function emitProgress(data: { completed: number; total: number; rps: number }, isJson: boolean) {
  const percent = Math.min(100, Math.round((data.completed / data.total) * 100));
  if (isJson) {
    console.log(JSON.stringify({ type: 'progress', ...data, percent }));
  } else {
    process.stdout.write(`\r[Progress] ${data.completed}/${data.total} requests (${percent}%) | Current: ${data.rps} req/sec`);
  }
}

export function emitDone(
  data: {
    total: number;
    p50: number;
    p95: number;
    p99: number;
    rps: number;
    preTier: number;
    postTier: number;
    durationSec: number;
  },
  isJson: boolean
) {
  if (isJson) {
    console.log(JSON.stringify({ type: 'done', ...data }));
  } else {
    console.log('\n\n========================================================================');
    console.log(' Load Surge Execution Summary');
    console.log('========================================================================');
    console.log(`Execution Duration:   ${data.durationSec}s`);
    console.log(`Total Requests Sent:  ${data.total}`);
    console.log(`Throughput (RPS):     ${data.rps} req/sec`);
    console.log(`Latency p50:          ${data.p50} ms`);
    console.log(`Latency p95:          ${data.p95} ms`);
    console.log(`Latency p99:          ${data.p99} ms`);
    console.log('------------------------------------------------------------------------');
    console.log(`Cluster Before Surge: Tier-${data.preTier}`);
    console.log(`Cluster After Surge:  Tier-${data.postTier}`);
    if (data.preTier !== data.postTier) {
      console.log(`[Shift Verified] Cluster dynamically shifted: Tier-${data.preTier} -> Tier-${data.postTier}`);
    } else {
      console.log(`[Tier Maintained] Load was absorbed within Tier-${data.postTier}`);
    }
    console.log('========================================================================\n');
  }
}

export async function runAutocannonWorkflow(options: AutocannonWorkflowOptions): Promise<void> {
  const { amount, connections, isJson } = parseCommonArgs(options.defaultAmount ?? 71, options.defaultConnections ?? 5);
  const preStatus = await getAdminStatus();

  if (!isJson) {
    console.log(`========================================================================`);
    console.log(` Autocannon Surge: ${options.routeLabel}`);
    console.log(` Target:         ${targetUrl}${options.path}`);
    console.log(` Requests:       ${amount} calls`);
    console.log(` Concurrency:    ${connections} active sockets`);
    console.log(` Starting Tier:  Tier-${preStatus.currentTier} (Load Score: ${preStatus.currentLoadScore})`);
    console.log(`========================================================================\n`);
  }

  const startTime = Date.now();
  let completed = 0;

  const instance = autocannon(
    {
      url: `${targetUrl}${options.path}`,
      method: options.method ?? 'GET',
      connections,
      amount,
      headers: options.headers,
      setupClient: options.setupClient
    },
    (err, _res) => {
      if (err) {
        if (isJson) {
          console.log(JSON.stringify({ type: 'error', message: err.message }));
        } else {
          console.error('Autocannon execution error:', err);
        }
      }
    }
  );

  const emitInterval = Math.max(1, Math.floor(amount / 20)); // Emit every ~5%
  instance.on('response', () => {
    completed++;
    if (completed % emitInterval === 0 || completed === amount) {
      const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
      const currentRps = Math.round(completed / elapsedSec);
      emitProgress({ completed, total: amount, rps: currentRps }, isJson);
    }
  });

  instance.on('done', async (result: autocannon.Result) => {
    const durationSec = Number(((Date.now() - startTime) / 1000).toFixed(2));
    const postStatus = await getAdminStatus();
    const p95Latency = (result.latency as any).p95 ?? result.latency.p97_5;

    emitDone(
      {
        total: result.requests.total,
        p50: result.latency.p50,
        p95: p95Latency,
        p99: result.latency.p99,
        rps: result.requests.average,
        preTier: preStatus.currentTier,
        postTier: postStatus.currentTier,
        durationSec
      },
      isJson
    );
  });
}
