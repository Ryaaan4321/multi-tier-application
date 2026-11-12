import { Prisma } from '@prisma/client';
import { ShardRouter } from '../infra/db/shard-router.js';
import { Order, OrderItem } from '../models/domain.js';
import { timeOperation } from '../telemetry/metrics.js';
import { getElapsedMsFromStart, recordTimelineSpan } from '../telemetry/timeline.js';
import { Logger } from 'pino';

export type TxClient = Prisma.TransactionClient;

export class OrderRepository {
  private logger: Logger;

  constructor(
    private readonly shardRouter: ShardRouter,
    private readonly tier: number,
    logger: Logger
  ) {
    this.logger = logger.child({ layer: 'DB', repository: 'OrderRepository' });
  }

  async withTransaction<T>(shardKey: string, fn: (tx: TxClient) => Promise<T>): Promise<T> {
    return timeOperation(
      '[DB] order_transaction_boundary',
      this.tier,
      async () => {
        const client = this.shardRouter.getClientForId(shardKey);
        return client.$transaction(async (tx) => {
          return fn(tx);
        });
      },
      this.logger
    );
  }

  async findByIdempotencyKey(key: string, shardKey?: string): Promise<Order | null> {
    return timeOperation(
      '[DB] order_find_by_idempotency_key',
      this.tier,
      async () => {
        if (this.tier !== 1 || shardKey) {
          const client = shardKey ? this.shardRouter.getClientForId(shardKey) : this.shardRouter.getPrimary();
          const record = await client.order.findUnique({
            where: { idempotencyKey: key },
            include: { items: true }
          })
          return record ? this.mapToDomain(record) : null;
        }
        const clients = this.shardRouter.getAllClients();
        const results = await Promise.all(clients.map((client) => {
          return client.order.findUnique({
            where: { idempotencyKey: key },
            include: { items: true }
          })
        })
        )
        const found = results.find(Boolean);
        return found ? this.mapToDomain(found) : null;
      },
      this.logger
    );
  }

  async findById(id: string): Promise<Order | null> {
    return timeOperation(
      '[DB] order_find_by_id',
      this.tier,
      async () => {
        const { label, client } = this.shardRouter.getLabeledReaderForId(id);
        const record = await timeOperation(
          `[DB] findById_${label}`,
          this.tier,
          () =>
            client.order.findUnique({
              where: { id },
              include: { items: true }
            })
        );

        if (!record) return null;
        return this.mapToDomain(record);
      },
      this.logger
    );
  }
  async findAll(params: { page: number; limit: number }): Promise<{ orders: Order[]; total: number }> {
    return timeOperation(
      '[DB] order_scatter_gather_find_all',
      this.tier,
      async () => {
        const skip = (params.page - 1) * params.limit;
        if (this.tier !== 1) {
          const client = this.shardRouter.getReader();
          const label = this.shardRouter.getReaderLabel();

          const records = await timeOperation(`[DB] findAll_${label}`, this.tier, () =>
            client.order.findMany({
              skip,
              take: params.limit,
              orderBy: { createdAt: 'desc' },
              // include: { items: true }
            })
          );
          return {
            orders: records.map((r) => this.mapToDomain(r)),
            total: records.length
          };
        }
        const labeledShards = this.shardRouter.getLabeledShards();
        const shardResults = await Promise.all(
          labeledShards.map(({ label, client }) =>
            timeOperation(`[DB] findAll_${label}`, this.tier, () =>
              client.order.findMany({
                take: params.page * params.limit,
                orderBy: { createdAt: 'desc' },
                include: { items: true }
              })
            )
          )
        );
        const mergeOffsetMs = getElapsedMsFromStart();
        const mergeStart = process.hrtime();
        const merged = shardResults
          .flat()
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(skip, skip + params.limit);

        const mapped = {
          orders: merged.map((r) => this.mapToDomain(r)),
          total: merged.length
        };
        const mergeDiff = process.hrtime(mergeStart);
        recordTimelineSpan({
          name: '[App] order_merge_sort_map',
          startOffsetMs: mergeOffsetMs,
          durationMs: Number((mergeDiff[0] * 1000 + mergeDiff[1] / 1e6).toFixed(2)),
          tier: this.tier
        });
        return mapped;
      },
      this.logger
    );
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
    return timeOperation(
      '[DB] order_create',
      this.tier,
      async () => {
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
        });
        return this.mapToDomain(created);
      },
      this.logger
    );
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
