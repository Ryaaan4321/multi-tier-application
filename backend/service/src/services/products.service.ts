import { ProductRepository } from '../repositories/products.repository.js';
import { ICacheManager } from '../infra/cache/cache.interface.js';
import { PaginatedResult, PaginationParams, Product } from '../models/domain.js';
import { NotFoundError } from '../errors/app-errors.js';
import { timeOperation } from '../telemetry/metrics.js';
import { Logger } from 'pino';

export class ProductService {
  private logger: Logger;

  constructor(
    private readonly productRepo: ProductRepository,
    private readonly cache: ICacheManager,
    private readonly tier: number,
    logger: Logger
  ) {
    this.logger = logger.child({ layer: 'Service', service: 'ProductService' });
  }

  async listProducts(params: PaginationParams): Promise<PaginatedResult<Product>> {
    return timeOperation(
      '[Service] product_list_flow',
      this.tier,
      async () => {
        const cacheKey = `products:p${params.page}:l${params.limit}`;

        const cached = await timeOperation(
          '[Cache] cache_get_products',
          this.tier,
          () => this.cache.get<PaginatedResult<Product>>(cacheKey),
          this.logger
        );

        if (cached) {
          return cached;
        }

        const { products, total } = await this.productRepo.findMany(params.page, params.limit);

        const result: PaginatedResult<Product> = {
          data: products,
          pagination: {
            page: params.page,
            limit: params.limit,
            total,
            totalPages: Math.ceil(total / params.limit)
          }
        };

        await timeOperation(
          '[Cache] cache_set_products',
          this.tier,
          () => this.cache.set(cacheKey, result, 30),
          this.logger
        );

        return result;
      },
      this.logger
    );
  }

  async getProductById(id: string): Promise<Product> {
    return timeOperation(
      '[Service] product_get_by_id_flow',
      this.tier,
      async () => {
        const cacheKey = `product:${id}`;

        const cached = await timeOperation(
          '[Cache] cache_get_product_by_id',
          this.tier,
          () => this.cache.get<Product>(cacheKey),
          this.logger
        );

        if (cached) {
          return cached;
        }

        const product = await this.productRepo.findById(id);

        if (!product) {
          throw new NotFoundError(`Product with id '${id}' not found`);
        }

        await timeOperation(
          '[Cache] cache_set_product_by_id',
          this.tier,
          () => this.cache.set(cacheKey, product, 60),
          this.logger
        );

        return product;
      },
      this.logger
    );
  }
}
