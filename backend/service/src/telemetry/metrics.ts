import client from 'prom-client';

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
  fn: () => Promise<T>
): Promise<T> {
  const end = operationDurationHistogram.startTimer({ operation, tier: tier.toString() });
  try {
    return await fn();
  } finally {
    end();
  }
}

export const prometheusRegistry = client.register;
