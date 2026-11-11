import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { ServiceContainer } from './container.js';
import { errorHandler } from './middlewares/error-handler.js';
import { productRoutes } from './routes/v1/products.routes.js';
import { orderRoutes } from './routes/v1/orders.routes.js';
import { systemRoutes } from './routes/v1/system.routes.js';
import { httpRequestDurationHistogram } from './telemetry/metrics.js';
import { RedisCacheManager } from './infra/cache/redis-cache.js';
import fastifyRateLimit from '@fastify/rate-limit';
import {
  getElapsedMsFromStart,
  recordTimelineSpan,
  TimelineContext,
  timelineStorage
} from './telemetry/timeline.js';
export async function buildApp(container: ServiceContainer) {
  const app = fastify({
    logger: container.logger as any,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: true });

  app.addHook('onRequest', (request, _reply, done) => {
    const startTime = process.hrtime();
    (request.raw as { startTime?: [number, number] }).startTime = startTime;
    const context: TimelineContext = { requestStartHr: startTime, spans: [] };
    (request as any).timelineContext = context;
    timelineStorage.run(context, () => {
      done();
    });
  });

  if (container.config.TIER <= 4) {
    const redisClient = container.cache instanceof RedisCacheManager ? container.cache.getClient() : undefined;
    await app.register(fastifyRateLimit, {
      max: 100,
      timeWindow: '1 minute',
      redis: redisClient
    });
  }

  app.addHook('preHandler', async () => {
    const middlewareMs = getElapsedMsFromStart();
    recordTimelineSpan({
      name: '[Middleware] hooks_and_rate_limit',
      startOffsetMs: 0,
      durationMs: middlewareMs,
      tier: container.config.TIER
    });
  });

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Served-By-Tier', `Tier-${container.config.TIER}`);
    const startTime = (request.raw as { startTime?: [number, number] }).startTime;
    if (startTime) {
      const diff = process.hrtime(startTime);
      const serviceDurationMs = Number((diff[0] * 1000 + diff[1] / 1e6).toFixed(2));
      reply.header('x-service-duration-ms', String(serviceDurationMs));
    }
    const context: TimelineContext | undefined = (request as any).timelineContext;
    const timeline = context?.spans ? [...context.spans].sort((a, b) => a.startOffsetMs - b.startOffsetMs) : [];
    if (timeline.length > 0) {
      reply.header('x-trace-timeline', JSON.stringify(timeline));
      const serverTiming = timeline
        .map((s, idx) => `op${idx};dur=${s.durationMs};desc="${s.name.replace(/[^a-zA-Z0-9_\-\[\] ]/g, '')}"`)
        .join(', ');
      reply.header('Server-Timing', serverTiming);
    }
    return payload;
  });
  app.addHook('onResponse', async (request, reply) => {
    reply.header('X-Served-By-Tier', `Tier-${container.config.TIER}`);

    const startTime = (request.raw as { startTime?: [number, number] }).startTime;
    if (startTime) {
      const diff = process.hrtime(startTime);
      const durationSeconds = diff[0] + diff[1] / 1e9;
      const durationMs = durationSeconds * 1000;
      const routePath = request.routeOptions?.url || request.url;

      httpRequestDurationHistogram
        .labels({
          method: request.method,
          route: routePath,
          status_code: reply.statusCode.toString(),
          tier: container.config.TIER.toString()
        })
        .observe(durationSeconds);
      container.logger.info(
        {
          layer: 'HTTP',
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          durationMs: Number(durationMs.toFixed(2)),
          tier: container.config.TIER
        },
        `[HTTP] ${request.method} ${request.url} -> ${reply.statusCode} in ${durationMs.toFixed(2)}ms [Tier: ${container.config.TIER}]`
      );
    }
  });

  app.setErrorHandler(errorHandler);

  await app.register(systemRoutes, {
    shardRouter: container.shardRouter,
    cache: container.cache,
    tier: container.config.TIER
  });

  await app.register(
    async (v1) => {
      await v1.register(productRoutes, { controller: container.productsController });
      await v1.register(orderRoutes, { controller: container.ordersController });
    },
    { prefix: '/api/v1' }
  );

  return app;
}
