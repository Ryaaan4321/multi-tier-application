import client from 'prom-client';
import { Logger } from 'pino';
import { tracer } from './tracer.js';
import { SpanStatusCode } from '@opentelemetry/api';
import { recordTimelineSpan } from './timeline.js';

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

export const httpRequestDurationHistogram = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'tier'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
});

export const operationDurationHistogram = new client.Histogram({
  name: 'operation_duration_seconds',
  help: 'Duration of granular system operations in seconds',
  labelNames: ['operation', 'tier'],
  buckets: [0.001, 0.002, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5]
});

export async function timeOperation<T>(
  operation: string,
  tier: number,
  fn: () => Promise<T>,
  logger?: Logger
): Promise<T> {
  return tracer.startActiveSpan(
    operation,
    { attributes: { 'gearbox.tier': tier, 'gearbox.operation': operation } },
    async (span) => {
      const start = process.hrtime();
      const end = operationDurationHistogram.startTimer({ operation, tier: tier.toString() });
      try {
        const result = await fn();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err: any) {
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err?.message || 'Operation error' });
        throw err;
      } finally {
        end();
        span.end();
        const diff = process.hrtime(start);
        const durationMs = diff[0] * 1000 + diff[1] / 1e6;
        recordTimelineSpan({
          name: operation,
          durationMs: Number(durationMs.toFixed(2)),
          tier
        });
        if (logger) {
          logger.info(
            { operation, tier, durationMs: Number(durationMs.toFixed(2)), traceId: span.spanContext().traceId },
            `${operation} took ${durationMs.toFixed(2)}ms`
          );
        }
      }
    }
  );
}

export const prometheusRegistry = client.register;
