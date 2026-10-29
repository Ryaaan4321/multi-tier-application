import { EnvConfig } from './config/env.js';
import { Logger } from 'pino';
import { ShardRouter } from './infra/db/shard-router.js';
import { ICacheManager } from './infra/cache/cache.interface.js';
import { NullCacheManager } from './infra/cache/null-cache.js';
import { RedisCacheManager } from './infra/cache/redis-cache.js';
import { IEmailSender } from './infra/email/email.interface.js';
import { DirectEmailSender } from './infra/email/direct-email.js';
import { KafkaEmailSender } from './infra/email/kafka-email.js';
import { IEventPublisher } from './infra/events/event.interface.js';
import { NullEventPublisher } from './infra/events/null-event-publisher.js';
import { KafkaEventPublisher } from './infra/events/kafka-event-publisher.js';
import { ProductRepository } from './repositories/products.repository.js';
import { OrderRepository } from './repositories/orders.repository.js';
import { ProductService } from './services/products.service.js';
import { OrderService } from './services/orders.service.js';
import { ProductsController } from './controllers/products.controller.js';
import { OrdersController } from './controllers/orders.controller.js';
import { KafkaProducerManager } from './infra/kafka/producer.js';
export interface ServiceContainer {
  config: EnvConfig;
  logger: Logger;
  shardRouter: ShardRouter;
  cache: ICacheManager;
  emailSender: IEmailSender;
  eventPublisher: IEventPublisher;
  productsController: ProductsController;
  ordersController: OrdersController;
  dispose(): Promise<void>;
}

export async function createContainer(config: EnvConfig, logger: Logger): Promise<ServiceContainer> {
  const containerLogger = logger.child({ module: 'CompositionRoot' });
  containerLogger.info({ tier: config.TIER }, 'Assembling service container for tier');

  const shardUrls = [config.SHARD_0_DATABASE_URL, config.SHARD_1_DATABASE_URL].filter(
    (url): url is string => Boolean(url)
  );

  const shardRouter = new ShardRouter({
    primaryUrl: config.DATABASE_URL,
    shardUrls,
    tier: config.TIER,
    logger
  });
  let cache: ICacheManager;
  if (config.TIER <= 5 && config.REDIS_URL) {
    const redisCache = new RedisCacheManager(config.REDIS_URL, logger);
    await redisCache.connect();
    cache = redisCache;
    containerLogger.info('Wired RedisCacheManager for tier ' + config.TIER);
  } else {
    cache = new NullCacheManager();
    containerLogger.info('Wired NullCacheManager for tier ' + config.TIER);
  }

  let emailSender: IEmailSender;
  let eventPublisher: IEventPublisher;
  let kafkaProducer: KafkaProducerManager | null = null;
  if (config.TIER <= 3) {
    const brokers = config.KAFKA_BROKERS ? config.KAFKA_BROKERS.split(',').map((b) => b.trim()) : ['localhost:9092'];
    kafkaProducer = new KafkaProducerManager(brokers, `gearbox-service-tier-${config.TIER}`, logger);
    await kafkaProducer.connect();
    emailSender = new KafkaEmailSender(kafkaProducer, logger);
    eventPublisher = new KafkaEventPublisher(kafkaProducer, logger);
    containerLogger.info('Wired KafkaEmailSender for tier ' + config.TIER);
  } else {
    emailSender = new DirectEmailSender(logger, 25);
    eventPublisher = new NullEventPublisher();
    containerLogger.info('Wired DirectEmailSender for tier ' + config.TIER);
  }

  const productRepo = new ProductRepository(shardRouter.getPrimary(), config.TIER, logger);
  const orderRepo = new OrderRepository(shardRouter, config.TIER, logger);

  const productService = new ProductService(productRepo, cache, config.TIER, logger);
  const orderService = new OrderService(orderRepo, productRepo, emailSender, eventPublisher, config.TIER, logger);

  const productsController = new ProductsController(productService, config.TIER, logger);
  const ordersController = new OrdersController(orderService, config.TIER, logger);

  return {
    config,
    logger,
    shardRouter,
    cache,
    emailSender,
    eventPublisher,
    productsController,
    ordersController,
    async dispose() {
      containerLogger.info('Disposing service container resources');
      await shardRouter.disconnectAll();
      if (cache instanceof RedisCacheManager) {
        await cache.disconnect();
      }
      if (kafkaProducer) {
        await kafkaProducer.disconnect();
      }
    }
  };
}
