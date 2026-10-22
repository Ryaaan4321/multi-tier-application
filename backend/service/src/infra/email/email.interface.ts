import { Order } from '../../models/domain.js';

export interface IEmailSender {
  sendOrderConfirmation(order: Order): Promise<void>;
}
