import { FastifyReply, FastifyRequest } from 'fastify';
import { ProductService } from '../services/products.service.js';
import { listProductsQuerySchema, productIdParamSchema } from '../validators/products.validator.js';
import { ApiResponse } from '../models/domain.js';
import { timeOperation } from '../telemetry/metrics.js';
import { Logger } from 'pino';

export class ProductsController {
  private logger: Logger;

  constructor(
    private readonly productService: ProductService,
    private readonly tier: number,
    logger: Logger
  ) {
    this.logger = logger.child({ layer: 'Controller', controller: 'ProductsController' });
  }

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await timeOperation(
      '[Controller] products_controller_list',
      this.tier,
      async () => {
        const query = listProductsQuerySchema.parse(request.query);
        const result = await this.productService.listProducts(query);

        const response: ApiResponse<typeof result> = {
          success: true,
          data: result
        };

        reply.status(200).send(response);
      },
      this.logger
    );
  }

  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await timeOperation(
      '[Controller] products_controller_get_by_id',
      this.tier,
      async () => {
        const params = productIdParamSchema.parse(request.params);
        const product = await this.productService.getProductById(params.id);

        const response: ApiResponse<typeof product> = {
          success: true,
          data: product
        };

        reply.status(200).send(response);
      },
      this.logger
    );
  }
}
