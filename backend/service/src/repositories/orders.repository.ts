import { Prisma } from '@prisma/client';
import { ShardRouter } from '../infra/db/shard-router.js';
import { Order, OrderItem } from '../models/domain.js';

export type TxClient = Prisma.TransactionClient;


export class OrderRepository {
  constructor(private readonly shardRouter: ShardRouter) { }

  async withTransaction<T>(shardKey: string, fn: (tx: TxClient) => Promise<T>): Promise<T> {
    const client = this.shardRouter.getClientForId(shardKey);
    return client.$transaction(async (tx) => {
      return fn(tx);
    });
  }

  async findByIdempotencyKey(key: string, shardKey?: string): Promise<Order | null> {
    const clients = shardKey
      ? [this.shardRouter.getClientForId(shardKey)]
      : this.shardRouter.getAllClients();

    for (const client of clients) {
      const record = await client.order.findUnique({
        where: { idempotencyKey: key },
        include: { items: true }
      });

      if (record) {
        return this.mapToDomain(record);
      }
    }

    return null;
  }

  async findById(id: string): Promise<Order | null> {
    const client = this.shardRouter.getClientForId(id);
    const record = await client.order.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findAll(params: { page: number, limit: number }): Promise<{ orders: Order[]; total: number }> {
    const clients = this.shardRouter.getAllClients();
    const skip = (params.page - 1) * params.limit;
    const shardPromises = clients.map(async (client) => {
      return client.order.findMany({
        take: params.limit,
        orderBy: { createdAt: "desc" },
        include: { items: true }
      })
    })
    const shardResults = await Promise.all(shardPromises);
    const merged = shardResults
      .flat()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, params.limit);
    return {
      orders: merged.map((r) => this.mapToDomain(r)),
      total: merged.length
    };
  }

  async create(
    data: {
      id: string;
      idempotencyKey: string;
      customerEmail: string;
      totalCents: number;
      items: { productId: string; quantity: number; unitPriceCents: number }[];
    },
    tx: TxClient
  ): Promise<Order> {
    const created = await tx.order.create({
      data: {
        id: data.id,
        idempotencyKey: data.idempotencyKey,
        customerEmail: data.customerEmail,
        totalCents: data.totalCents,
        status: 'CONFIRMED',
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents
          }))
        }
      },
      include: {
        items: true
      }
    });

    return this.mapToDomain(created);
  }

  private mapToDomain(record: {
    id: string;
    idempotencyKey: string;
    customerEmail: string;
    totalCents: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    items?: {
      id: string;
      orderId: string;
      productId: string;
      quantity: number;
      unitPriceCents: number;
      createdAt: Date;
    }[];
  }): Order {
    return {
      id: record.id,
      idempotencyKey: record.idempotencyKey,
      customerEmail: record.customerEmail,
      totalCents: record.totalCents,
      status: record.status as 'PENDING' | 'CONFIRMED' | 'FAILED',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      items: record.items?.map((item): OrderItem => ({
        id: item.id,
        orderId: item.orderId,
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        createdAt: item.createdAt
      }))
    };
  }
}
