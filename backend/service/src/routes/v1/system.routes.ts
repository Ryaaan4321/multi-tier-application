import { FastifyInstance } from 'fastify';
import { ShardRouter } from '../../infra/db/shard-router.js';
import { ICacheManager } from '../../infra/cache/cache.interface.js';
import { prometheusRegistry } from '../../telemetry/metrics.js';

export async function systemRoutes(
  fastify: FastifyInstance,
  options: { shardRouter: ShardRouter; cache: ICacheManager; tier: number }
): Promise<void> {
  const { shardRouter, tier } = options;
  fastify.get('/health', async (_req, reply) => {
    reply.status(200).send({ status: 'ok', tier });
  });
  fastify.get('/ready', async (_req, reply) => {
    try {
      const clients = shardRouter.getAllClients();
      await Promise.all(clients.map((c) => c.$queryRaw`SELECT 1`));
      reply.status(200).send({
        status: 'ready',
        tier,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      fastify.log.warn({ err }, 'Readiness probe failed');
      reply.status(503).send({
        status: 'not_ready',
        tier,
        error: (err as Error).message
      });
    }
  });
  fastify.get('/metrics', async (_req, reply) => {
    const metrics = await prometheusRegistry.metrics();
    reply.header('Content-Type', prometheusRegistry.contentType).send(metrics);
  });
}
