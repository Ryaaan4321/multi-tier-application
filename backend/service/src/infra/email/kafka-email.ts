import { IEmailSender } from './email.interface.js';
import { Order } from '../../models/domain.js';
import { Logger } from 'pino';
import { KafkaProducerManager } from '../kafka/producer.js';
import { timeStamp } from 'console';

export class KafkaEmailSender implements IEmailSender {
  private logger: Logger;
  private producer: KafkaProducerManager;

  constructor(producer: KafkaProducerManager, logger: Logger) {
    this.producer = producer;
    this.logger = logger.child({ module: 'KafkaEmailSender' });
  }

  async sendOrderConfirmation(order: Order): Promise<void> {
    const topic = 'emails.dispatch';
    await this.producer.send(topic, order.id, {
      type: 'ORDER_CONFIRMATION',
      orderId: order.id,
      recipient: order.customerEmail,
      timeStamp: new Date().toISOString()
    });
    this.logger.info(
      { orderId: order.id, recipient: order.customerEmail, topic },
      'Order confirmation email event queued to Kafka'
    );
  }
}
