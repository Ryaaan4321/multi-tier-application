import pino from 'pino';
import { loadProxyConfig } from './config/env.js';
import { createProxyContext, buildProxyApp } from './app.js';

async function main(): Promise<void> {
  const config = loadProxyConfig();

  const logger = pino({
    level: config.LOG_LEVEL,
    transport:
      config.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: { colorize: true }
          }
        : undefined
  });

  logger.info({ port: config.PORT }, 'Starting Gearbox reverse proxy');

  const context = createProxyContext(config, logger);
  const app = await buildProxyApp(context);

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Termination signal received, closing proxy gracefully');
    try {
      await app.close();
      await context.poolManager.closeAll();
      logger.info('Proxy shutdown completed cleanly');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during proxy shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    logger.info({ port: config.PORT }, `Gearbox reverse proxy listening on 0.0.0.0:${config.PORT}`);
  } catch (err) {
    logger.fatal({ err }, 'Failed to start proxy server');
    await context.poolManager.closeAll();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal initialization error in proxy:', err);
  process.exit(1);
});
