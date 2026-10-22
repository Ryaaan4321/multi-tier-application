import { FastifyReply, FastifyRequest } from 'fastify';
import { ProductService } from '../services/products.service.js';
import { listProductsQuerySchema, productIdParamSchema } from '../validators/products.validator.js';
import { ApiResponse } from '../models/domain.js';

export class ProductsController {
  constructor(private readonly productService: ProductService) {}

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = listProductsQuerySchema.parse(request.query);
    const result = await this.productService.listProducts(query);

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result
    };

    reply.status(200).send(response);
  }

  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const params = productIdParamSchema.parse(request.params);
    const product = await this.productService.getProductById(params.id);

    const response: ApiResponse<typeof product> = {
      success: true,
      data: product
    };

    reply.status(200).send(response);
  }
}
