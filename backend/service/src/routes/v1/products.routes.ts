import { FastifyInstance } from 'fastify';
import { ProductsController } from '../../controllers/products.controller.js';

export async function productRoutes(fastify: FastifyInstance, options: { controller: ProductsController }): Promise<void> {
  const { controller } = options;

  fastify.get('/products', (req, reply) => controller.list(req, reply));
  fastify.get('/products/:id', (req, reply) => controller.getById(req, reply));
}
