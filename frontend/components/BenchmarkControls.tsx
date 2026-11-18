'use client';

import React, { useState } from 'react';
import {
  Play,
  Square,
  Sliders,
  Send,
  Timer,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { BenchmarkProgress, BenchmarkDone } from '../hooks/useBenchmarkStream';
import { TierBadge } from './TierBadge';

interface BenchmarkControlsProps {
  isRunning: boolean;
  progress: BenchmarkProgress | null;
  doneResult: BenchmarkDone | null;
  error: string | null;
  activeRoute: 'orders' | 'get-orders' | 'products';
  onRouteChange: (route: 'orders' | 'get-orders' | 'products') => void;
  connections: number;
  onConnectionsChange: (val: number) => void;
  amount: number;
  onAmountChange: (val: number) => void;
  single: boolean;
  onSingleChange: (val: boolean) => void;
  onStart: () => void;
  onAbort: () => void;
}

export function BenchmarkControls({
  isRunning,
  progress,
  doneResult,
  error,
  activeRoute,
  onRouteChange,
  connections,
  onConnectionsChange,
  amount,
  onAmountChange,
  single,
  onSingleChange,
  onStart,
  onAbort
}: BenchmarkControlsProps) {
  return (
    <div className="w-full rounded-2xl border-2 border-slate-900 bg-white p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between border-b-2 border-slate-100 pb-4 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-900 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
            <Sliders className="h-5 w-5 text-slate-900 dark:text-zinc-100" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-zinc-100">
              Interactive Load Engine
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Adjust parameters to test how Gearbox balances high-concurrency traffic
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={onAbort}
              className="flex items-center gap-2 rounded-xl border-2 border-rose-600 bg-rose-50 px-4 py-2 font-mono text-xs font-black text-rose-700 transition-all hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <Square className="h-4 w-4 fill-current" />
              ABORT LOAD
            </button>
          ) : (
            <button
              onClick={onStart}
              className="flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-slate-900 px-5 py-2.5 font-mono text-xs font-black text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:bg-slate-800 active:translate-y-0 active:shadow-none dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]"
            >
              <Play className="h-4 w-4 fill-current" />
              FIRE LOAD TEST
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col gap-3 rounded-xl border-2 border-slate-900 bg-slate-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Target Endpoint Route
          </div>

          <div className="flex flex-col gap-2">
            {[
              {
                id: 'orders' as const,
                title: 'POST /orders',
                sub: 'High-cost transaction write, inventory lock'
              },
              {
                id: 'get-orders' as const,
                title: 'GET /orders',
                sub: 'Orders query list & detail cache'
              },
              {
                id: 'products' as const,
                title: 'GET /products',
                sub: 'Product catalog cache test'
              }
            ].map((route) => {
              const active = activeRoute === route.id;
              return (
                <button
                  key={route.id}
                  disabled={isRunning}
                  onClick={() => onRouteChange(route.id)}
                  className={`flex flex-col items-start rounded-lg border-2 p-2.5 text-left transition-all ${
                    active
                      ? 'border-slate-900 bg-white font-bold shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:border-zinc-100 dark:bg-zinc-800 dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]'
                      : 'border-transparent bg-transparent text-slate-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <span className="font-mono text-xs font-black text-slate-900 dark:text-zinc-100">
                    {route.title}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                    {route.sub}
                  </span>
                </button>
              );
            })}
          </div>

          {(activeRoute === 'products' || activeRoute === 'get-orders') && (
            <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
              <input
                type="checkbox"
                disabled={isRunning}
                checked={single}
                onChange={(e) => onSingleChange(e.target.checked)}
                className="h-4 w-4 rounded border-slate-400 accent-slate-900"
              />
              <span>Target Single Item ID (Cache Saturation)</span>
            </label>
          )}
        </div>

        {/* Requests Volume Slider */}
        <div className="flex flex-col justify-between rounded-xl border-2 border-slate-900 bg-slate-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Total Request Volume
              </span>
              <span className="rounded-md border border-slate-900 bg-white px-2 py-0.5 font-mono text-xs font-black text-slate-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
                {amount} reqs
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
              Total number of requests fired by Autocannon
            </p>

            <div className="mt-6">
              <input
                type="range"
                disabled={isRunning}
                min={10}
                max={5000}
                step={10}
                value={amount}
                onChange={(e) => onAmountChange(Number(e.target.value))}
                className="w-full accent-slate-900 dark:accent-zinc-100"
              />
              <div className="mt-2 flex justify-between text-[10px] font-mono text-slate-400">
                <span>10 req</span>
                <span>1,000 req</span>
                <span>5,000 req</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            {[50, 100, 500, 1000].map((preset) => (
              <button
                key={preset}
                disabled={isRunning}
                onClick={() => onAmountChange(preset)}
                className={`flex-1 rounded-md border py-1 font-mono text-[11px] font-bold transition-all ${
                  amount === preset
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Concurrency Sockets Slider */}
        <div className="flex flex-col justify-between rounded-xl border-2 border-slate-900 bg-slate-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Concurrent Connections
              </span>
              <span className="rounded-md border border-slate-900 bg-white px-2 py-0.5 font-mono text-xs font-black text-slate-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
                {connections} sockets
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
              Clamped to &le; 25 to protect Linux file descriptors
            </p>

            <div className="mt-6">
              <input
                type="range"
                disabled={isRunning}
                min={1}
                max={25}
                step={1}
                value={connections}
                onChange={(e) => onConnectionsChange(Number(e.target.value))}
                className="w-full accent-slate-900 dark:accent-zinc-100"
              />
              <div className="mt-2 flex justify-between text-[10px] font-mono text-slate-400">
                <span>1 conn</span>
                <span>10 conn</span>
                <span>25 max</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            {[1, 5, 10, 25].map((preset) => (
              <button
                key={preset}
                disabled={isRunning}
                onClick={() => onConnectionsChange(preset)}
                className={`flex-1 rounded-md border py-1 font-mono text-[11px] font-bold transition-all ${
                  connections === preset
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>
      {isRunning && progress && (
        <div className="mt-6 rounded-xl border-2 border-slate-900 bg-slate-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs font-mono font-bold">
            <span className="flex items-center gap-2 text-slate-900 dark:text-zinc-100">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              Running Benchmark: {progress.completed} / {progress.total} requests
            </span>
            <span className="text-indigo-600 dark:text-indigo-400">
              {progress.rps} req/sec | {progress.percent}%
            </span>
          </div>

          <div className="mt-3 h-3 w-full overflow-hidden rounded-full border border-slate-900 bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800">
            <div
              className="h-full bg-slate-900 transition-all duration-150 dark:bg-zinc-100"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border-2 border-rose-500 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
      {doneResult && !isRunning && (
        <div className="mt-6 rounded-xl border-2 border-emerald-500 bg-emerald-50/50 p-5 shadow-[3px_3px_0px_0px_rgba(16,185,129,1)] dark:border-emerald-800 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between border-b border-emerald-200 pb-3 dark:border-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-mono text-sm font-black text-emerald-950 dark:text-emerald-200">
                BENCHMARK COMPLETED
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Tier Transition:</span>
              <TierBadge tier={doneResult.preTier} size="sm" />
              <span className="text-slate-400">&rarr;</span>
              <TierBadge tier={doneResult.postTier} size="sm" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="rounded-lg border border-emerald-200 bg-white p-3 dark:border-emerald-900 dark:bg-zinc-900">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Avg Throughput
              </div>
              <div className="mt-1 font-mono text-lg font-black text-slate-900 dark:text-zinc-100">
                {doneResult.rps} <span className="text-xs font-normal">RPS</span>
              </div>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-white p-3 dark:border-emerald-900 dark:bg-zinc-900">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                p50 Latency
              </div>
              <div className="mt-1 font-mono text-lg font-black text-slate-900 dark:text-zinc-100">
                {doneResult.p50} <span className="text-xs font-normal">ms</span>
              </div>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-white p-3 dark:border-emerald-900 dark:bg-zinc-900">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                p95 Latency
              </div>
              <div className="mt-1 font-mono text-lg font-black text-slate-900 dark:text-zinc-100">
                {doneResult.p95} <span className="text-xs font-normal">ms</span>
              </div>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-white p-3 dark:border-emerald-900 dark:bg-zinc-900">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                p99 Latency
              </div>
              <div className="mt-1 font-mono text-lg font-black text-slate-900 dark:text-zinc-100">
                {doneResult.p99} <span className="text-xs font-normal">ms</span>
              </div>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-white p-3 dark:border-emerald-900 dark:bg-zinc-900">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Duration
              </div>
              <div className="mt-1 font-mono text-lg font-black text-slate-900 dark:text-zinc-100">
                {doneResult.durationSec.toFixed(2)} <span className="text-xs font-normal">sec</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
