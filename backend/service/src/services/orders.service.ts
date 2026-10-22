import { OrderRepository } from '../repositories/orders.repository.js';
import { ProductRepository } from '../repositories/products.repository.js';
import { IEmailSender } from '../infra/email/email.interface.js';
import { IEventPublisher } from '../infra/events/event.interface.js';
import { CreateOrderInput, Order } from '../models/domain.js';
import { NotFoundError } from '../errors/app-errors.js';
import { generateUuidV7 } from '../utils/uuidv7.js';
import { Logger } from 'pino';
import { timeOperation } from '../telemetry/metrics.js';

export class OrderService {
  private logger: Logger;

  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly productRepo: ProductRepository,
    private readonly emailSender: IEmailSender,
    private readonly eventPublisher: IEventPublisher,
    private readonly tier: number,
    logger: Logger
  ) {
    this.logger = logger.child({ module: 'OrderService' });
  }

  async createOrder(input: CreateOrderInput): Promise<{ order: Order; isReplay: boolean }> {
    const existingOrder = await timeOperation('db_order_idempotency_lookup', this.tier, () =>
      this.orderRepo.findByIdempotencyKey(input.idempotencyKey)
    );

    if (existingOrder) {
      this.logger.info(
        { idempotencyKey: input.idempotencyKey, orderId: existingOrder.id },
        'Idempotent order request detected, returning existing order'
      );
      return { order: existingOrder, isReplay: true };
    }

    const orderId = generateUuidV7();

    const createdOrder = await timeOperation('db_order_transaction', this.tier, () =>
      this.orderRepo.withTransaction(orderId, async (tx) => {
        let totalCents = 0;
        const resolvedItems: { productId: string; quantity: number; unitPriceCents: number }[] = [];

        for (const item of input.items) {
          const updatedProduct = await timeOperation('db_stock_decrement', this.tier, () =>
            this.productRepo.decrementStock(item.productId, item.quantity, tx)
          );

          const itemTotal = updatedProduct.priceCents * item.quantity;
          totalCents += itemTotal;

          resolvedItems.push({
            productId: item.productId,
            quantity: item.quantity,
            unitPriceCents: updatedProduct.priceCents
          });
        }

        return timeOperation('db_order_create', this.tier, () =>
          this.orderRepo.create(
            {
              id: orderId,
              idempotencyKey: input.idempotencyKey,
              customerEmail: input.customerEmail,
              totalCents,
              items: resolvedItems
            },
            tx
          )
        );
      })
    );

    timeOperation('email_send', this.tier, () =>
      this.emailSender.sendOrderConfirmation(createdOrder)
    ).catch((err) => {
      this.logger.error({ err, orderId: createdOrder.id }, 'Background email dispatch failed');
    });

    timeOperation('event_publish', this.tier, () =>
      this.eventPublisher.publish('order.created', {
        orderId: createdOrder.id,
        customerEmail: createdOrder.customerEmail,
        totalCents: createdOrder.totalCents,
        itemCount: createdOrder.items?.length ?? 0
      })
    ).catch((err) => {
      this.logger.error({ err, orderId: createdOrder.id }, 'Background event publication failed');
    });

    return { order: createdOrder, isReplay: false };
  }

  async getOrderById(id: string): Promise<Order> {
    const order = await timeOperation('db_order_find_by_id', this.tier, () =>
      this.orderRepo.findById(id)
    );

    if (!order) {
      throw new NotFoundError(`Order with id '${id}' not found`);
    }

    return order;
  }
}
