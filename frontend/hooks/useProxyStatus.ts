'use client';

import { useState, useEffect, useCallback } from 'react';

export interface CircuitBreakerState {
  state: 'CLOSED' | 'HALF_OPEN' | 'OPEN';
  failures: number;
}

export interface TierSwitchEvent {
  timestamp: string;
  fromTier: number;
  toTier: number;
  loadScore: number;
  reason: string;
}

export interface AdminStatus {
  currentTier: number;
  currentLoadScore: number;
  manualOverride: number | null;
  cooldownPeriodMs: number;
  lastSwitchTimestamp: string;
  circuitBreakers: Record<string, CircuitBreakerState>;
  switchHistory: TierSwitchEvent[];
}

export function useProxyStatus(proxyUrl: string = 'http://localhost:3000', pollIntervalMs: number = 750) {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${proxyUrl}/admin/status`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        const data: AdminStatus = await res.json();
        setStatus(data);
        setIsConnected(true);
        setLastUpdated(new Date());
      } else {
        setIsConnected(false);
      }
    } catch {
      setIsConnected(false);
    }
  }, [proxyUrl]);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, pollIntervalMs);
    return () => clearInterval(timer);
  }, [fetchStatus, pollIntervalMs]);

  return { status, isConnected, lastUpdated, refetch: fetchStatus };
}
