import { AsyncLocalStorage } from 'async_hooks';

export interface TimelineSpan {
  name: string;
  durationMs: number;
  tier: number;
}

export const timelineStorage = new AsyncLocalStorage<TimelineSpan[]>();

export function recordTimelineSpan(span: TimelineSpan): void {
  const store = timelineStorage.getStore();
  if (store) {
    store.push(span);
  }
}

