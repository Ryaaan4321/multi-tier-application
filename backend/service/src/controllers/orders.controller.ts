import { FastifyReply, FastifyRequest } from 'fastify';
import { OrderService } from '../services/orders.service.js';
import { createOrderBodySchema, orderIdParamSchema } from '../validators/orders.validator.js';
import { listProductsQuerySchema } from '../validators/products.validator.js';
import { ApiResponse } from '../models/domain.js';
import { ValidationError } from '../errors/app-errors.js';
import { timeOperation } from '../telemetry/metrics.js';
import { Logger } from 'pino';

export class OrdersController {
  private logger: Logger;

  constructor(
    private readonly orderService: OrderService,
    private readonly tier: number,
    logger: Logger
  ) {
    this.logger = logger.child({ layer: 'Controller', controller: 'OrdersController' });
  }

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await timeOperation(
      '[Controller] orders_controller_create',
      this.tier,
      async () => {
        const rawIdempotencyKey = request.headers['idempotency-key'];
        if (!rawIdempotencyKey || typeof rawIdempotencyKey !== 'string') {
          throw new ValidationError('Header Idempotency-Key is required');
        }

        const body = createOrderBodySchema.parse(request.body);

        const { order, isReplay } = await this.orderService.createOrder({
          idempotencyKey: rawIdempotencyKey,
          customerEmail: body.customerEmail,
          items: body.items
        });

        const response: ApiResponse<typeof order> = {
          success: true,
          data: order
        };

        const statusCode = isReplay ? 200 : 201;
        reply.status(statusCode).send(response);
      },
      this.logger
    );
  }

  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await timeOperation(
      '[Controller] orders_controller_get_by_id',
      this.tier,
      async () => {
        const params = orderIdParamSchema.parse(request.params);
        const order = await this.orderService.getOrderById(params.id);

        const response: ApiResponse<typeof order> = {
          success: true,
          data: order
        };

        reply.status(200).send(response);
      },
      this.logger
    );
  }

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await timeOperation(
      '[Controller] orders_controller_list',
      this.tier,
      async () => {
        const query = listProductsQuerySchema.parse(request.query);
        const result = await this.orderService.listOrders(query);

        const response: ApiResponse<typeof result> = {
          success: true,
          data: result
        };

        reply.status(200).send(response);
      },
      this.logger
    );
  }
}
