import { IEmailSender } from './email.interface.js';
import { Order } from '../../models/domain.js';
import { Logger } from 'pino';

export class KafkaEmailSender implements IEmailSender {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ module: 'KafkaEmailSender' });
  }

  async sendOrderConfirmation(order: Order): Promise<void> {
    this.logger.info(
      {
        orderId: order.id,
        recipient: order.customerEmail,
        topic: 'emails.dispatch'
      },
      'Order confirmation email queued to Kafka'
    );
  }
}
