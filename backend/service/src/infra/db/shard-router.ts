import { PrismaClient } from '@prisma/client';
import { Logger } from 'pino';

export interface ShardRouterOptions {
  primaryUrl: string;
  shardUrls: string[];
  tier: number;
  logger: Logger;
}

export class ShardRouter {
  private primaryClient: PrismaClient;
  private shardClients: PrismaClient[];
  private logger: Logger;

  constructor(options: ShardRouterOptions) {
    this.logger = options.logger.child({ module: 'ShardRouter' });

    const poolLimit = this.getConnectionLimitForTier(options.tier);
    const primaryWithPool = this.appendConnectionLimit(options.primaryUrl, poolLimit);

    this.primaryClient = new PrismaClient({
      datasources: {
        db: { url: primaryWithPool }
      }
    });

    if (options.shardUrls.length > 0) {
      this.shardClients = options.shardUrls.map((url) => {
        const urlWithPool = this.appendConnectionLimit(url, poolLimit);
        return new PrismaClient({
          datasources: {
            db: { url: urlWithPool }
          }
        });
      });
    } else {
      this.shardClients = [this.primaryClient];
    }

    this.logger.info(
      {
        tier: options.tier,
        poolLimit,
        shardCount: this.shardClients.length
      },
      'Database shard router initialized'
    );
  }
  private getConnectionLimitForTier(tier: number): number {
    switch (tier) {
      case 6:
        return 2;
      case 5:
        return 5;
      case 4:
        return 8;
      case 3:
        return 12;
      case 2:
        return 16;
      case 1:
        return 25;
      default:
        return 5;
    }
  }
  private appendConnectionLimit(baseUrl: string, limit: number): string {
    const separator = baseUrl.includes('?') ? '&' : '?';
    if (baseUrl.includes('connection_limit=')) {
      return baseUrl;
    }
    return `${baseUrl}${separator}connection_limit=${limit}`;
  }

  public getPrimary(): PrismaClient {
    return this.primaryClient;
  }

  public getClientForId(id: string): PrismaClient {
    if (this.shardClients.length === 1) {
      return this.shardClients[0];
    }
    const shardIndex = this.hashStringToShard(id, this.shardClients.length);
    return this.shardClients[shardIndex];
  }

  public getAllClients(): PrismaClient[] {
    const all = [this.primaryClient, ...this.shardClients];
    return Array.from(new Set(all));
  }

  private hashStringToShard(str: string, shardCount: number): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash) % shardCount;
  }

  async disconnectAll(): Promise<void> {
    const clients = this.getAllClients();
    await Promise.all(clients.map((c) => c.$disconnect()));
  }
}
