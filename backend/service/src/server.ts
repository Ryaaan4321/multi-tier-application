import pino from 'pino';
import { loadConfig } from './config/env.js';
import { createContainer } from './container.js';
import { buildApp } from './app.js';

async function main(): Promise<void> {
  const config = loadConfig();

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

  logger.info({ tier: config.TIER, port: config.PORT }, 'Starting Gearbox service instance');

  const container = await createContainer(config, logger);
  const app = await buildApp(container);

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received termination signal, starting graceful shutdown');
    try {
      await app.close();
      await container.dispose();
      logger.info('Graceful shutdown completed successfully');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error occurred during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    logger.info({ port: config.PORT, tier: config.TIER }, `Service listening on 0.0.0.0:${config.PORT}`);
  } catch (err) {
    logger.fatal({ err }, 'Failed to start HTTP server');
    await container.dispose();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
