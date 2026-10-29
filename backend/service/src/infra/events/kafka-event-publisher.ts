import { IEventPublisher } from './event.interface.js';
import { Logger } from 'pino';
import { KafkaProducerManager } from '../kafka/producer.js';
import { timeStamp } from 'console';

export class KafkaEventPublisher implements IEventPublisher {
  private logger: Logger;
  private producer: KafkaProducerManager;
  constructor(producer: KafkaProducerManager, logger: Logger) {
    this.producer = producer;
    this.logger = logger.child({ module: 'KafkaEventPublisher' });
  }

  async publish(eventName: string, payload: Record<string, unknown>): Promise<void> {
    const topic = 'domain.events';
    const key = (payload.orderId as string) || (payload.id as string) || 'generic'
    await this.producer.send(topic, key, {
      eventName,
      payload,
      timeStamp: new Date().toISOString()
    })
    this.logger.info(
      { eventName, payload, key },
      'Domain event published to Kafka'
    )
  }
}
