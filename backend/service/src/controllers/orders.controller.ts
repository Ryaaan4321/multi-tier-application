import { FastifyReply, FastifyRequest } from 'fastify';
import { OrderService } from '../services/orders.service.js';
import { createOrderBodySchema, orderIdParamSchema } from '../validators/orders.validator.js';
import { ApiResponse } from '../models/domain.js';
import { ValidationError } from '../errors/app-errors.js';

export class OrdersController {
  constructor(private readonly orderService: OrderService) {}

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
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
  }

  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const params = orderIdParamSchema.parse(request.params);
    const order = await this.orderService.getOrderById(params.id);

    const response: ApiResponse<typeof order> = {
      success: true,
      data: order
    };

    reply.status(200).send(response);
  }
}
