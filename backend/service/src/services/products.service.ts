import { ProductRepository } from '../repositories/products.repository.js';
import { ICacheManager } from '../infra/cache/cache.interface.js';
import { PaginatedResult, PaginationParams, Product } from '../models/domain.js';
import { NotFoundError } from '../errors/app-errors.js';
import { timeOperation } from '../telemetry/metrics.js';

export class ProductService {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly cache: ICacheManager,
    private readonly tier: number
  ) {}

  async listProducts(params: PaginationParams): Promise<PaginatedResult<Product>> {
    const cacheKey = `products:p${params.page}:l${params.limit}`;

    const cached = await timeOperation('cache_get_products', this.tier, () =>
      this.cache.get<PaginatedResult<Product>>(cacheKey)
    );

    if (cached) {
      return cached;
    }

    const { products, total } = await timeOperation('db_find_products_paginated', this.tier, () =>
      this.productRepo.findMany(params.page, params.limit)
    );

    const result: PaginatedResult<Product> = {
      data: products,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit)
      }
    };

    await timeOperation('cache_set_products', this.tier, () =>
      this.cache.set(cacheKey, result, 30)
    );

    return result;
  }

  async getProductById(id: string): Promise<Product> {
    const cacheKey = `product:${id}`;

    const cached = await timeOperation('cache_get_product_by_id', this.tier, () =>
      this.cache.get<Product>(cacheKey)
    );

    if (cached) {
      return cached;
    }

    const product = await timeOperation('db_find_product_by_id', this.tier, () =>
      this.productRepo.findById(id)
    );

    if (!product) {
      throw new NotFoundError(`Product with id '${id}' not found`);
    }

    await timeOperation('cache_set_product_by_id', this.tier, () =>
      this.cache.set(cacheKey, product, 60)
    );

    return product;
  }
}
