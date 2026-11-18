'use client';

import { useState, useRef, useCallback } from 'react';

export interface BenchmarkProgress {
  completed: number;
  total: number;
  rps: number;
  percent: number;
}
export interface BenchmarkDone {
  total: number;
  p50: number;
  p95: number;
  p99: number;
  rps: number;
  preTier: number;
  postTier: number;
  durationSec: number;
}
export interface UseBenchmarkStreamOptions {
  proxyUrl?: string;
  onDone?: (result: BenchmarkDone) => void;
  onError?: (error: string) => void;
}
export function useBenchmarkStream({
  proxyUrl = 'http://localhost:3000',
  onDone,
  onError
}: UseBenchmarkStreamOptions = {}) {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<BenchmarkProgress | null>(null);
  const [doneResult, setDoneResult] = useState<BenchmarkDone | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortBenchmark = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsRunning(false);
  }, []);
  const startBenchmark = useCallback(
    (params: {
      type: 'orders' | 'get-orders' | 'products';
      amount: number;
      connections: number;
      single?: boolean;
    }) => {
      abortBenchmark();
      setIsRunning(true);
      setProgress(null);
      setDoneResult(null);
      setError(null);
      const query = new URLSearchParams({
        type: params.type,
        amount: String(params.amount),
        connections: String(params.connections),
        ...(params.single ? { single: 'true' } : {})
      });
      const url = `${proxyUrl}/admin/benchmark/stream?${query.toString()}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'progress') {
            setProgress({
              completed: payload.completed,
              total: payload.total,
              rps: payload.rps,
              percent: payload.percent
            });
          } else if (payload.type === 'done') {
            setDoneResult(payload);
            onDone?.(payload);
          } else if (payload.type === 'error') {
            setError(payload.message || 'Benchmark error occurred');
            onError?.(payload.message || 'Benchmark error occurred');
            abortBenchmark();
          } else if (payload.type === 'exit') {
            setIsRunning(false);
            es.close();
            eventSourceRef.current = null;
          }
        } catch {
          
        }
      };
      es.onerror = () => {
        setError('Lost connection to benchmark stream');
        setIsRunning(false);
        es.close();
        eventSourceRef.current = null;
      };
    },
    [proxyUrl, abortBenchmark, onDone, onError]
  );
  return {
    isRunning,
    progress,
    doneResult,
    error,
    startBenchmark,
    abortBenchmark
  };
}
