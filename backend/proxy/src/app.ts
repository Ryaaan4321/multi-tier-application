import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { Logger } from 'pino';
import { ProxyEnvConfig } from './config/env.js';
import { RouteCostEvaluator } from './engine/cost-map.js';
import { SlidingWindowCounter } from './engine/sliding-window.js';
import { selectTier, TierThreshold } from './engine/tier-selector.js';
import { HttpPoolManager, TierTarget } from './forwarder/http-pool.js';
import {
  prometheusRegistry,
  proxyCurrentLoadScoreGauge,
  proxyCurrentTierGauge,
  proxyRequestDurationHistogram,
  proxyTierSwitchesCounter
} from './telemetry/metrics.js';

export interface TierSwitchEvent {
  timestamp: string;
  fromTier: number;
  toTier: number;
  loadScore: number;
  reason: string;
}

export interface ProxyAppContext {
  config: ProxyEnvConfig;
  logger: Logger;
  costEvaluator: RouteCostEvaluator;
  slidingWindow: SlidingWindowCounter;
  poolManager: HttpPoolManager;
  currentTier: number;
  lastSwitchTimestamp: number;
  switchHistory: TierSwitchEvent[];
  thresholds: Record<number, TierThreshold>;
}

export function createProxyContext(config: ProxyEnvConfig, logger: Logger): ProxyAppContext {
  const targets: TierTarget[] = [
    { tier: 6, url: config.TIER_6_URL },
    { tier: 5, url: config.TIER_5_URL },
    { tier: 4, url: config.TIER_4_URL },
    { tier: 3, url: config.TIER_3_URL },
    { tier: 2, url: config.TIER_2_URL },
    { tier: 1, url: config.TIER_1_URL }
  ];

  const thresholds: Record<number, TierThreshold> = {
    6: { up: 250, down: 0 },
    5: { up: 500, down: 150 },
    4: { up: 1000, down: 350 },
    3: { up: 2000, down: 750 },
    2: { up: 4000, down: 1500 },
    1: { up: 999999, down: 3000 }
  };

  const initialTier = config.MANUAL_TIER_OVERRIDE ?? 6;
  proxyCurrentTierGauge.set(initialTier);
  proxyCurrentLoadScoreGauge.set(0);

  return {
    config,
    logger,
    costEvaluator: new RouteCostEvaluator(1),
    slidingWindow: new SlidingWindowCounter(config.SLIDING_WINDOW_SECONDS),
    poolManager: new HttpPoolManager(targets, logger),
    currentTier: initialTier,
    lastSwitchTimestamp: Date.now(),
    switchHistory: [],
    thresholds
  };
}

export async function buildProxyApp(context: ProxyAppContext): Promise<FastifyInstance> {
  const app = fastify({
    logger: context.logger as any,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: true });

  app.addHook('onRequest', async (request) => {
    (request.raw as { startTime?: [number, number] }).startTime = process.hrtime();
  });

  app.addHook('onResponse', async (request, reply) => {
    const startTime = (request.raw as { startTime?: [number, number] }).startTime;
    if (startTime) {
      const diff = process.hrtime(startTime);
      const durationSeconds = diff[0] + diff[1] / 1e9;
      const durationMs = durationSeconds * 1000;
      const servedTier = reply.getHeader('X-Served-By-Tier') || `Tier-${context.currentTier}`;

      proxyRequestDurationHistogram
        .labels({
          method: request.method,
          status_code: reply.statusCode.toString(),
          served_by_tier: String(servedTier)
        })
        .observe(durationSeconds);

      context.logger.info(
        {
          layer: 'Proxy',
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          durationMs: Number(durationMs.toFixed(2)),
          servedByTier: servedTier,
          currentLoadScore: context.slidingWindow.getScore()
        },
        `[Proxy] ${request.method} ${request.url} -> ${reply.statusCode} via ${servedTier} in ${durationMs.toFixed(2)}ms`
      );
    }
  });

  app.get('/health', async (_req, reply) => {
    reply.status(200).send({ status: 'ok', role: 'gearbox-proxy' });
  });

  app.get('/metrics', async (_req, reply) => {
    const metrics = await prometheusRegistry.metrics();
    reply.header('Content-Type', prometheusRegistry.contentType).send(metrics);
  });

  app.get('/admin/status', async (_req, reply) => {
    const score = context.slidingWindow.getScore();
    const breakerStates = context.poolManager.getAllBreakerStates();

    reply.status(200).send({
      currentTier: context.currentTier,
      currentLoadScore: score,
      manualOverride: context.config.MANUAL_TIER_OVERRIDE ?? null,
      cooldownPeriodMs: context.config.COOLDOWN_PERIOD_MS,
      lastSwitchTimestamp: new Date(context.lastSwitchTimestamp).toISOString(),
      circuitBreakers: breakerStates,
      switchHistory: context.switchHistory.slice(-10)
    });
  });

  app.setNotFoundHandler(async (request, reply) => {
    const now = Date.now();
    const cost = context.costEvaluator.evaluate(request.method, request.url);
    context.slidingWindow.add(cost, now);

    const loadScore = context.slidingWindow.getScore(now);
    proxyCurrentLoadScoreGauge.set(loadScore);

    let targetTier = context.currentTier;

    if (context.config.MANUAL_TIER_OVERRIDE) {
      targetTier = context.config.MANUAL_TIER_OVERRIDE;
    } else {
      const evaluation = selectTier({
        currentTier: context.currentTier,
        loadScore,
        lastSwitchTimestamp: context.lastSwitchTimestamp,
        currentTimestamp: now,
        cooldownPeriodMs: context.config.COOLDOWN_PERIOD_MS,
        thresholds: context.thresholds
      });

      if (evaluation.didSwitch) {
        context.logger.info(
          {
            fromTier: context.currentTier,
            toTier: evaluation.nextTier,
            loadScore,
            reason: evaluation.reason
          },
          `[Gearbox Switch] Transitioned from Tier ${context.currentTier} to Tier ${evaluation.nextTier} (${evaluation.reason})`
        );

        proxyTierSwitchesCounter
          .labels({
            from_tier: String(context.currentTier),
            to_tier: String(evaluation.nextTier),
            reason: evaluation.reason
          })
          .inc();

        context.switchHistory.push({
          timestamp: new Date().toISOString(),
          fromTier: context.currentTier,
          toTier: evaluation.nextTier,
          loadScore,
          reason: evaluation.reason
        });

        if (context.switchHistory.length > 50) {
          context.switchHistory.shift();
        }

        context.currentTier = evaluation.nextTier;
        context.lastSwitchTimestamp = now;
        proxyCurrentTierGauge.set(context.currentTier);
      }

      targetTier = context.currentTier;
    }

    await context.poolManager.forward(targetTier, request, reply);
  });

  return app;
}
