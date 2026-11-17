import { FastifyInstance } from 'fastify';
import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '../../..');

let activeBenchmarkChild: ChildProcess | null = null;

export function registerBenchmarkRoutes(app: FastifyInstance, proxyPort: number) {
  app.get('/admin/benchmark/stream', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const type = query.type || 'orders';
    const isSingle = query.single === 'true' || query.single === '1';
    if (activeBenchmarkChild !== null) {
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Access-Control-Allow-Origin', '*');
      reply.raw.write(
        `data: ${JSON.stringify({
          type: 'error',
          message: 'A benchmark run is already in progress. Please wait for it to finish.'
        })}\n\n`
      );
      reply.raw.end();
      return;
    }
    const amount = Math.min(5000, Math.max(1, parseInt(query.amount || '71', 10)));
    const connections = Math.min(25, Math.max(1, parseInt(query.connections || '5', 10)));
    const scriptMap: Record<string, string> = {
      orders: 'autocannon-orders.ts',
      'get-orders': 'autocannon-get-orders.ts',
      products: 'autocannon-products.ts'
    };
    const scriptName = scriptMap[type] || 'autocannon-orders.ts';
    const scriptPath = path.resolve(backendDir, 'scripts', scriptName);
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.flushHeaders();
    reply.raw.write(`data: ${JSON.stringify({ type: 'start', script: scriptName, amount, connections })}\n\n`);
    const childArgs = [
      'tsx',
      scriptPath,
      '--amount', String(amount),
      '--connections', String(connections),
      '--json'
    ];
    if (isSingle) {
      childArgs.push('--single');
    }
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const child = spawn(npxCmd, childArgs, {
      cwd: backendDir,
      env: { ...process.env, TARGET_URL: `http://localhost:${proxyPort}` },
      shell: process.platform === 'win32'
    });
    activeBenchmarkChild = child;
    child.stdout.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter((l) => l.trim().length > 0);
      for (const line of lines) {
        reply.raw.write(`data: ${line}\n\n`);
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      const errorText = chunk.toString().trim();
      if (errorText) {
        reply.raw.write(`data: ${JSON.stringify({ type: 'stderr', message: errorText })}\n\n`);
      }
    });
    child.on('close', (code) => {
      activeBenchmarkChild = null;
      reply.raw.write(`data: ${JSON.stringify({ type: 'exit', code })}\n\n`);
      reply.raw.end();
    });
    request.raw.on('close', () => {
      if (activeBenchmarkChild === child) {
        if (!child.killed) {
          child.kill();
        }
        activeBenchmarkChild = null;
      }
    });
  });
}