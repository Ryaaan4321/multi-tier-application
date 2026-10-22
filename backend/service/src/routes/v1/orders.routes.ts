import { FastifyInstance } from 'fastify';
import { OrdersController } from '../../controllers/orders.controller.js';

export async function orderRoutes(fastify: FastifyInstance, options: { controller: OrdersController }): Promise<void> {
  const { controller } = options;

  fastify.post('/orders', (req, reply) => controller.create(req, reply));
  fastify.get('/orders/:id', (req, reply) => controller.getById(req, reply));
}
