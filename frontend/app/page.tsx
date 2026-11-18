'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Server,
  Activity,
  History,
  Radio,
  ExternalLink,
  Settings,
  ChevronDown
} from 'lucide-react';
import { useProxyStatus } from '../hooks/useProxyStatus';
import { useBenchmarkStream } from '../hooks/useBenchmarkStream';
import { SystemTopology } from '../components/SystemTopology';
import { BenchmarkControls } from '../components/BenchmarkControls';
import { TierBadge } from '../components/TierBadge';

export default function GearboxDashboard() {
  const defaultUrl = process.env.NEXT_PUBLIC_PROXY_URL || "";
  const [proxyUrl, setProxyUrlState] = useState<string>(defaultUrl);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const setProxyUrl = (url: string) => {
    setProxyUrlState(url);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gearbox_proxy_url', url);
    }
  };
  const [activeRoute, setActiveRoute] = useState<'orders' | 'get-orders' | 'products'>('orders');
  const [amount, setAmount] = useState<number>(100);
  const [connections, setConnections] = useState<number>(5);
  const [single, setSingle] = useState<boolean>(false);
  const { status, isConnected, lastUpdated } = useProxyStatus(proxyUrl, 750);
  const {
    isRunning,
    progress,
    doneResult,
    error,
    startBenchmark,
    abortBenchmark
  } = useBenchmarkStream({ proxyUrl });

  const handleStart = () => {
    startBenchmark({
      type: activeRoute,
      amount,
      connections,
      single
    });
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] text-slate-900 transition-colors dark:bg-[#0c0c0c] dark:text-zinc-100">
      <header className="sticky top-0 z-50 border-b-2 border-slate-900 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-900 bg-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:border-zinc-200 dark:bg-white dark:text-black">
              <span className="font-mono text-lg font-black">G</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-lg font-black tracking-tight">GEARBOX</h1>
                <span className="rounded-full border border-slate-900 px-2 py-0.5 text-[10px] font-mono font-bold dark:border-zinc-700">
                  v1.0-proxy
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Adaptive Load-Aware Reverse Proxy & Tier Shifter
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-slate-50 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isConnected
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-rose-500'
                }`}
              />
              <span className="font-mono text-xs font-bold">
                {isConnected ? 'Proxy Connected' : 'Connecting to Proxy...'}
              </span>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white p-2 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)]"
              title="Target Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
        {showSettings && (
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Proxy Target URL:
              </span>
              <input
                type="text"
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
                className="w-72 rounded-lg border-2 border-slate-900 bg-white px-3 py-1 font-mono text-xs font-bold text-slate-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                placeholder="http://localhost:3000"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setProxyUrl('http://localhost:3000')}
                  className={`rounded-md border px-2.5 py-1 font-mono text-[11px] font-bold transition-all ${
                    proxyUrl === 'http://localhost:3000'
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  Local (3000)
                </button>
                <button
                  type="button"
                  onClick={() => setProxyUrl('http://3.24.216.227:3000')}
                  className={`rounded-md border px-2.5 py-1 font-mono text-[11px] font-bold transition-all ${
                    proxyUrl === 'http://3.24.216.227:3000'
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  EC2 (3.24.216.227)
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8">        <SystemTopology
          status={status}
          isRunning={isRunning}
          activeRoute={activeRoute}
          connections={connections}
        />
        <BenchmarkControls
          isRunning={isRunning}
          progress={progress}
          doneResult={doneResult}
          error={error}
          activeRoute={activeRoute}
          onRouteChange={setActiveRoute}
          connections={connections}
          onConnectionsChange={setConnections}
          amount={amount}
          onAmountChange={setAmount}
          single={single}
          onSingleChange={setSingle}
          onStart={handleStart}
          onAbort={abortBenchmark}
        />
        {status?.switchHistory && status.switchHistory.length > 0 && (
          <div className="w-full rounded-2xl border-2 border-slate-900 bg-white p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
            <div className="mb-4 flex items-center gap-3 border-b-2 border-slate-100 pb-3 dark:border-zinc-800">
              <History className="h-5 w-5 text-slate-900 dark:text-zinc-100" />
              <h3 className="font-mono text-sm font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
                Recent Gear Shift Events
              </h3>
            </div>

            <div className="flex flex-col gap-2">
              {status.switchHistory.slice(-5).reverse().map((event, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-400">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <TierBadge tier={event.fromTier} size="sm" />
                      <span className="text-slate-400">&rarr;</span>
                      <TierBadge tier={event.toTier} size="sm" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                      Load Score: <span className="font-bold">{event.loadScore.toFixed(1)}</span>
                    </span>
                    <span className="rounded bg-slate-200 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-800 dark:bg-zinc-800 dark:text-zinc-300">
                      {event.reason}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
