import { AsyncLocalStorage } from 'node:async_hooks';

export interface TimelineSpan {
  name: string;
  durationMs: number;
  startOffsetMs: number;
  tier: number;
}

export interface TimelineContext {
  requestStartHr: [number, number];
  spans: TimelineSpan[];
}

export const timelineStorage = new AsyncLocalStorage<TimelineContext>();

export function getElapsedMsFromStart(): number {
  const store = timelineStorage.getStore();
  if (!store) return 0;
  const diff = process.hrtime(store.requestStartHr);
  return Number((diff[0] * 1000 + diff[1] / 1e6).toFixed(2));
}

export function recordTimelineSpan(span: TimelineSpan): void {
  const store = timelineStorage.getStore();
  if (store) {
    store.spans.push(span);
  }
}
