export interface TimelineSpan {
  name: string;
  durationMs: number;
  startOffsetMs?: number;
  tier: number;
}

export interface TierFlamegraphRow {
  TargetTier: string;
  ServedByTier: string;
  StatusCode: number;
  ClientMs: number;
  InternetRttMs: number;
  ProxyMs: number;
  ServiceMs: number;
  MiddlewareMs: number;
  SlowestDbSpan: string;
  Details: string;
}

export interface EndpointProfileOptions {
  title: string;
  targetUrl: string;
  path: string;
  dbLeafPrefixes: string[];
  formatDetails: (json: any, status: number) => string;
}

function renderTimeShiftedBar(startOffsetMs: number, durationMs: number, axisMs: number, barWidth: number): string {
  const safeAxis = axisMs > 0 ? axisMs : 1;
  const startCol = Math.min(barWidth - 1, Math.max(0, Math.floor((startOffsetMs / safeAxis) * barWidth)));
  const spanCols = Math.max(1, Math.min(barWidth - startCol, Math.round((durationMs / safeAxis) * barWidth)));
  const leftPad = ' '.repeat(startCol);
  const block = '█'.repeat(spanCols);
  const rightPad = ' '.repeat(Math.max(0, barWidth - startCol - spanCols));
  return `${leftPad}${block}${rightPad}`;
}

/**
 * Probes a GET endpoint across all 6 Gearbox tiers with X-Force-Tier
 * and renders a staggered E2E flamegraph per tier.
 */
export async function profileGetEndpointAcrossTiers(options: EndpointProfileOptions): Promise<void> {
  const tiers = [6, 5, 4, 3, 2, 1];
  const results: TierFlamegraphRow[] = [];
  const barWidth = 36;
  const fullUrl = `${options.targetUrl}${options.path}`;

  console.log('========================================================================');
  console.log(` ${options.title}`);
  console.log(` Target Cluster: ${options.targetUrl}`);
  console.log(` Endpoint: GET ${options.path}`);
  console.log('========================================================================\n');

  for (const tier of tiers) {
    const start = performance.now();
    const res = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'x-force-tier': String(tier)
      }
    });
    const bodyText = await res.text();
    const clientTotalMs = Number((performance.now() - start).toFixed(2));

    let json: any = {};
    try {
      json = JSON.parse(bodyText);
    } catch {}

    const servedBy = res.headers.get('x-served-by-tier') || 'Unknown';
    const proxyTotalMs = Number(res.headers.get('x-proxy-total-ms') || 0);
    const proxyOverheadMs = Number(res.headers.get('x-proxy-overhead-ms') || 0);
    const proxyUpstreamMs = Number(res.headers.get('x-proxy-upstream-ms') || 0);
    const serviceDurationMs = Number(res.headers.get('x-service-duration-ms') || 0);
    const timelineHeader = res.headers.get('x-trace-timeline');

    const internetRttMs = proxyTotalMs > 0 ? Number(Math.max(0, clientTotalMs - proxyTotalMs).toFixed(2)) : 0;
    const proxyTransitMs =
      proxyUpstreamMs > 0 && serviceDurationMs > 0
        ? Number(Math.max(0, proxyUpstreamMs - serviceDurationMs).toFixed(2))
        : 0;

    let spans: TimelineSpan[] = [];
    if (timelineHeader) {
      try {
        spans = JSON.parse(timelineHeader);
      } catch {}
    }

    const middlewareSpan = spans.find((s) => s.name.includes('[Middleware]'));
    const dbLeafSpans = spans.filter((s) => options.dbLeafPrefixes.some((prefix) => s.name.startsWith(prefix)));
    const slowestDb = dbLeafSpans.reduce<TimelineSpan | null>(
      (max, curr) => (!max || curr.durationMs > max.durationMs ? curr : max),
      null
    );

    const details = options.formatDetails(json, res.status);
    const serverAxisMs =
      serviceDurationMs > 0
        ? serviceDurationMs
        : Math.max(...spans.map((s) => (s.startOffsetMs ?? 0) + s.durationMs), 1);

    console.log(`--- Tier-${tier} | Served by: ${servedBy} | Status: ${res.status} | ${details} ---`);
    console.log(
      `  Client Total: ${clientTotalMs}ms = Internet RTT (${internetRttMs}ms) + Proxy (${proxyOverheadMs}ms) + Proxy<->Svc (${proxyTransitMs}ms) + Service (${serviceDurationMs}ms)`
    );

    if (spans.length > 0) {
      console.log(`  [Service Flamegraph: 0ms -> ${serverAxisMs}ms]`);
      const sorted = [...spans].sort((a, b) => (a.startOffsetMs ?? 0) - (b.startOffsetMs ?? 0));
      for (const span of sorted) {
        const offset = span.startOffsetMs ?? 0;
        const bar = renderTimeShiftedBar(offset, span.durationMs, serverAxisMs, barWidth);
        const pct = ((span.durationMs / serverAxisMs) * 100).toFixed(0).padStart(3, ' ');
        const isSlowestDb = slowestDb && span.name === slowestDb.name && dbLeafSpans.length >= 1 && span.durationMs >= serverAxisMs * 0.4;
        const note = isSlowestDb ? ' <-- [BOTTLENECK]' : '';
        console.log(
          `    ${span.name.padEnd(36, ' ')} @${offset.toFixed(1).padStart(6, ' ')}ms |${bar}| ${span.durationMs.toFixed(1).padStart(6, ' ')}ms (${pct}%)${note}`
        );
      }
    }
    console.log('');

    results.push({
      TargetTier: `Tier-${tier}`,
      ServedByTier: servedBy,
      StatusCode: res.status,
      ClientMs: Math.round(clientTotalMs),
      InternetRttMs: Math.round(internetRttMs),
      ProxyMs: Number(proxyOverheadMs.toFixed(1)),
      ServiceMs: Math.round(serviceDurationMs),
      MiddlewareMs: Number((middlewareSpan?.durationMs ?? 0).toFixed(1)),
      SlowestDbSpan: slowestDb ? `${slowestDb.name.replace('[DB] ', '')} (${Math.round(slowestDb.durationMs)}ms)` : 'N/A',
      Details: details
    });
  }

  console.log('========================================================================');
  console.log(` Summary Comparison Table Across All 6 Tiers (GET ${options.path})`);
  console.log('========================================================================');
  console.table(results);
}

