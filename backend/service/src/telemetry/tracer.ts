import { trace } from '@opentelemetry/api';
import { NodeTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';

class WaterfallSpanExporter implements SpanExporter {
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    for (const span of spans) {
      const durationMs = (span.duration[0] * 1000 + span.duration[1] / 1e6).toFixed(2);
      const tier = span.attributes['gearbox.tier'] ?? '?';
      const hasParent = Boolean(span.parentSpanContext?.spanId);
      const prefix = hasParent ? '  └── [Child Span]' : '[Root Span]';
      if (process.env.OTEL_LOG_SPANS === 'true' || process.env.NODE_ENV === 'development') {
        console.log(`${prefix} ${span.name} (${durationMs}ms) [Tier-${tier}] [TraceID: ${span.spanContext().traceId.slice(0, 8)}]`);
      }
    }
    resultCallback({ code: ExportResultCode.SUCCESS });
  }
  async shutdown(): Promise<void> { }
}
const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'gearbox-service'
  }),
  spanProcessors: [new SimpleSpanProcessor(new WaterfallSpanExporter())]
});
provider.register();
export const tracer = trace.getTracer('gearbox-service');
