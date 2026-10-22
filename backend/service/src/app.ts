import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { ServiceContainer } from './container.js';
import { errorHandler } from './middlewares/error-handler.js';
import { productRoutes } from './routes/v1/products.routes.js';
import { orderRoutes } from './routes/v1/orders.routes.js';
import { systemRoutes } from './routes/v1/system.routes.js';
import { httpRequestDurationHistogram } from './telemetry/metrics.js';

export async function buildApp(container: ServiceContainer) {
  const app = fastify({
    logger: container.logger as any,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: true });

  app.addHook('onRequest', async (request) => {
    (request.raw as { startTime?: [number, number] }).startTime = process.hrtime();
  });

  app.addHook('onResponse', async (request, reply) => {
    reply.header('X-Served-By-Tier', `Tier-${container.config.TIER}`);

    const startTime = (request.raw as { startTime?: [number, number] }).startTime;
    if (startTime) {
      const diff = process.hrtime(startTime);
      const durationSeconds = diff[0] + diff[1] / 1e9;
      const routePath = request.routeOptions?.url || request.url;

      httpRequestDurationHistogram
        .labels({
          method: request.method,
          route: routePath,
          status_code: reply.statusCode.toString(),
          tier: container.config.TIER.toString()
        })
        .observe(durationSeconds);
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
