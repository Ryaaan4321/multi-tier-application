import client from 'prom-client';

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

export const proxyRequestDurationHistogram = new client.Histogram({
  name: 'proxy_request_duration_seconds',
  help: 'Total duration of proxy requests in seconds',
  labelNames: ['method', 'status_code', 'served_by_tier'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5]
});

export const proxyCurrentLoadScoreGauge = new client.Gauge({
  name: 'proxy_current_load_score',
  help: 'Current rolling weighted load score in the sliding window'
});

export const proxyCurrentTierGauge = new client.Gauge({
  name: 'proxy_current_tier',
  help: 'Currently active upstream service tier'
});

export const proxyTierSwitchesCounter = new client.Counter({
  name: 'proxy_tier_switches_total',
  help: 'Total number of dynamic tier transitions',
  labelNames: ['from_tier', 'to_tier', 'reason']
});

export const prometheusRegistry = client.register;
