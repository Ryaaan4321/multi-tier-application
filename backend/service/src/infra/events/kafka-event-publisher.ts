import { IEventPublisher } from './event.interface.js';
import { Logger } from 'pino';

export class KafkaEventPublisher implements IEventPublisher {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ module: 'KafkaEventPublisher' });
  }

  async publish(eventName: string, payload: Record<string, unknown>): Promise<void> {
    this.logger.info(
      {
        eventName,
        payload
      },
      'Domain event published to Kafka'
    );
  }
}
