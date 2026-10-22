import { IEmailSender } from './email.interface.js';
import { Order } from '../../models/domain.js';
import { Logger } from 'pino';

export class DirectEmailSender implements IEmailSender {
  private logger: Logger;
  private simulatedLatencyMs: number;

  constructor(logger: Logger, simulatedLatencyMs: number = 30) {
    this.logger = logger.child({ module: 'DirectEmailSender' });
    this.simulatedLatencyMs = simulatedLatencyMs;
  }

  async sendOrderConfirmation(order: Order): Promise<void> {
    const startTime = Date.now();

    if (this.simulatedLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.simulatedLatencyMs));
    }

    const durationMs = Date.now() - startTime;
    this.logger.info(
      {
        orderId: order.id,
        recipient: order.customerEmail,
        durationMs
      },
      'Order confirmation email sent directly'
    );
  }
}
