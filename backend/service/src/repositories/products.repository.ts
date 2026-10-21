import { Prisma, PrismaClient } from '@prisma/client';
import { Product } from '../models/domain.js';
import { InsufficientStockError } from '../errors/app-errors.js';

export type TxClient = Prisma.TransactionClient;

export class ProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findMany(page: number, limit: number): Promise<{ products: Product[]; total: number }> {
    const skip = (page - 1) * limit;
    const [records, total] = await Promise.all([
      this.prisma.product.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.product.count()
    ]);

    const products: Product[] = records.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      priceCents: r.priceCents,
      stockQuantity: r.stockQuantity,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));

    return { products, total };
  }

  async findById(id: string, tx?: TxClient): Promise<Product | null> {
    const client = tx || this.prisma;
    const record = await client.product.findUnique({
      where: { id }
    });

    if (!record) return null;

    return {
      id: record.id,
      name: record.name,
      description: record.description,
      priceCents: record.priceCents,
      stockQuantity: record.stockQuantity,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  async decrementStock(id: string, quantity: number, tx: TxClient): Promise<Product> {
    const product = await tx.product.findUnique({
      where: { id }
    });

    if (!product || product.stockQuantity < quantity) {
      throw new InsufficientStockError(id, product?.stockQuantity ?? 0, quantity);
    }

    const updated = await tx.product.update({
      where: { id },
      data: {
        stockQuantity: { decrement: quantity }
      }
    });

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      priceCents: updated.priceCents,
      stockQuantity: updated.stockQuantity,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };
  }
}
