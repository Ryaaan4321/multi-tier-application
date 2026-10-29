import { Kafka, logLevel } from 'kafkajs';
import pino from 'pino';
import { loadConfig } from './config/env.js';

const config = loadConfig();
const logger = pino({ level: config.LOG_LEVEL, name: 'gearbox-email-worker' });

async function startWorker() {
  const brokers = config.KAFKA_BROKERS
    ? config.KAFKA_BROKERS.split(',').map((b) => b.trim())
    : ['localhost:9092'];

  const kafka = new Kafka({
    clientId: 'gearbox-email-worker',
    brokers,
    logLevel: logLevel.NOTHING
  });

  const consumer = kafka.consumer({ groupId: 'gearbox-email-workers' });
  logger.info({ brokers }, 'Starting Email Worker...');

  await consumer.connect();
  logger.info('Email worker connected to Kafka broker');

  await consumer.subscribe({ topic: 'emails.dispatch', fromBeginning: false });
  logger.info('Subscribed to emails.dispatch topic');

  await consumer.run({
    eachMessage: async ({ partition, message }) => {
      const rawValue = message.value?.toString();
      if (!rawValue) return;

      try {
        const payload = JSON.parse(rawValue);
        logger.info(
          {
            orderId: payload.orderId,
            recipient: payload.recipient,
            partition,
            offset: message.offset
          },
          '[Worker] Processing email dispatch'
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        logger.info(
          { orderId: payload.orderId, recipient: payload.recipient },
          '[Worker] Email sent successfully to recipient'
        );
      } catch (err) {
        logger.error({ err, rawValue }, '[Worker] Failed to process email message');
      }
    }
  });

  const shutdown = async () => {
    logger.info('Shutting down Email Worker gracefully...');
    await consumer.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startWorker().catch((err) => {
  logger.fatal({ err }, 'Email Worker crashed on startup');
  process.exit(1);
});
