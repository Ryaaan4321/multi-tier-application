import { Pool } from 'undici';
import { FastifyRequest, FastifyReply } from 'fastify';
import { TierCircuitBreaker } from './circuit-breaker.js';
import { Logger } from 'pino';

export interface TierTarget {
  tier: number;
  url: string;
}
export interface ForwardResult {
  servedByTier: number;
  statusCode: number;
  fallbackOccurred: boolean;
}
export class HttpPoolManager {
  private pools: Map<number, Pool> = new Map();
  private breakers: Map<number, TierCircuitBreaker> = new Map();
  private urls: Map<number, string> = new Map();
  private logger: Logger;
  constructor(targets: TierTarget[], logger: Logger) {
    this.logger = logger.child({ module: 'HttpPoolManager' });
    for (const target of targets) {
      const pool = new Pool(target.url, {
        connections: 50,
        pipelining: 1,
        keepAliveTimeout: 60000,
        keepAliveMaxTimeout: 600000
      });
      this.pools.set(target.tier, pool);
      this.breakers.set(target.tier, new TierCircuitBreaker({ failureThreshold: 5, recoveryTimeoutMs: 10000 }));
      this.urls.set(target.tier, target.url);
    }
  }
  getBreaker(tier: number): TierCircuitBreaker | undefined {
    return this.breakers.get(tier);
  }
  getAllBreakerStates(): Record<number, string> {
    const states: Record<number, string> = {};
    for (const [tier, breaker] of this.breakers.entries()) {
      states[tier] = breaker.getState();
    }
    return states;
  }
  private resolveHealthyTier(preferredTier: number): number | null {
    const sortedTiers = Array.from(this.pools.keys()).sort((a, b) => b - a);
    const candidateTiers = sortedTiers.filter((t) => t <= preferredTier);
    for (const tier of candidateTiers) {
      const breaker = this.breakers.get(tier);
      if (breaker && breaker.canExecute()) {
        return tier;
      }
    }
    for (const tier of sortedTiers) {
      const breaker = this.breakers.get(tier);
      if (breaker && breaker.canExecute()) {
        return tier;
      }
    }
    return null;
  }
  async forward(preferredTier: number, request: FastifyRequest, reply: FastifyReply): Promise<ForwardResult> {
    const targetTier = this.resolveHealthyTier(preferredTier);
    if (targetTier === null) {
      this.logger.error({ preferredTier }, 'All upstream tiers are degraded or unavailable');
      reply.status(503).header('Retry-After', '5').send({
        success: false,
        error: {
          code: 'ALL_TIERS_UNAVAILABLE',
          message: 'All service tiers are currently degraded or unreachable. Retry after 5 seconds.'
        }
      });
      return { servedByTier: preferredTier, statusCode: 503, fallbackOccurred: false };
    }
    const pool = this.pools.get(targetTier)!;
    const breaker = this.breakers.get(targetTier)!;
    const fallbackOccurred = targetTier !== preferredTier;
    if (fallbackOccurred) {
      this.logger.warn(
        { preferredTier, targetTier },
        `Upstream circuit breaker tripped for Tier ${preferredTier}, falling back to Tier ${targetTier}`
      );
    }
    const headers: Record<string, string> = {};
    for (const [key, val] of Object.entries(request.headers)) {
      if (val !== undefined && key.toLowerCase() !== 'host') {
        headers[key] = Array.isArray(val) ? val.join(',') : String(val);
      }
    }
    headers['x-forwarded-for'] = request.ip;
    headers['x-forwarded-proto'] = request.protocol;
    const requestId = (request.headers['x-request-id'] as string) || request.id;
    headers['x-request-id'] = requestId;
    try {
      const upstreamResponse = await pool.request({
        path: request.raw.url || request.url,
        method: request.method as any,
        headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.raw : undefined
      });
      const statusCode = upstreamResponse.statusCode;
      if (statusCode >= 500) {
        breaker.recordFailure();
      } else {
        breaker.recordSuccess();
      }
      for (const [headerKey, headerVal] of Object.entries(upstreamResponse.headers)) {
        if (headerVal !== undefined && headerKey.toLowerCase() !== 'transfer-encoding') {
          reply.header(headerKey, headerVal);
        }
      }
      reply.header('X-Served-By-Tier', `Tier-${targetTier}`);
      reply.header('X-Request-Id', requestId);
      reply.status(statusCode);
      reply.send(upstreamResponse.body);
      return {
        servedByTier: targetTier,
        statusCode,
        fallbackOccurred
      };
    } catch (err) {
      breaker.recordFailure();
      this.logger.error({ err, targetTier, url: request.url }, 'Upstream tier connection error');
      reply.status(502).send({
        success: false,
        error: {
          code: 'BAD_GATEWAY',
          message: `Failed to communicate with upstream Tier ${targetTier}`
        }
      });
      return {
        servedByTier: targetTier,
        statusCode: 502,
        fallbackOccurred
      };
    }
  }
  async closeAll(): Promise<void> {
    for (const pool of this.pools.values()) {
      await pool.close();
    }
  }
}
