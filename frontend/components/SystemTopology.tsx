'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Layers,
  Zap,
  GitFork,
  Radio,
  Mail,
  Gauge,
  Users,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { AdminStatus } from '../hooks/useProxyStatus';
import { TierBadge, getTierDescription } from './TierBadge';

interface SystemTopologyProps {
  status: AdminStatus | null;
  isRunning: boolean;
  activeRoute: 'orders' | 'get-orders' | 'products';
  connections: number;
}

export function SystemTopology({
  status,
  isRunning,
  activeRoute,
  connections
}: SystemTopologyProps) {
  const currentTier = status?.currentTier ?? 6;
  const loadScore = status?.currentLoadScore ?? 0;
  const isRedisActive = currentTier <= 5;
  const isReplicaActive = currentTier <= 5;
  const isShardingActive = currentTier <= 4;
  const isKafkaActive = currentTier <= 3;
  const isWorkerAsync = currentTier <= 3;
  const doesRouteHitRedis = isRedisActive && (activeRoute === 'products' || activeRoute === 'get-orders');
  const doesRouteHitReplica = isReplicaActive && (activeRoute === 'products' || activeRoute === 'get-orders');
  const doesRouteHitKafka = isKafkaActive && activeRoute === 'orders';
  const doesRouteHitPrimary = activeRoute === 'orders' || !isReplicaActive;

  return (
    <div className="w-full rounded-2xl border-2 border-slate-900 bg-white p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b-2 border-slate-100 pb-4 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-900 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
            <Activity className="h-5 w-5 text-slate-900 dark:text-zinc-100" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-zinc-100">
              Live Architecture Topology
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Active components dynamically illuminate as Gearbox shifts down tiers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Sliding Window Load
            </div>
            <div className="font-mono text-sm font-black text-slate-900 dark:text-zinc-100">
              {loadScore.toFixed(1)} / 100.0
            </div>
          </div>
          <TierBadge tier={currentTier} size="lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="flex flex-col gap-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            1. Ingress Tier
          </div>
          <div
            className={`relative rounded-xl border-2 p-4 transition-all duration-300 ${
              isRunning
                ? 'border-emerald-500 bg-emerald-50/50 shadow-[2px_2px_0px_0px_rgba(16,185,129,1)] dark:bg-emerald-950/20'
                : 'border-slate-900 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-slate-700 dark:text-zinc-300" />
                <span className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                  Client Traffic
                </span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                  isRunning
                    ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200'
                    : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
              >
                {isRunning ? `${connections} Sockets Active` : 'Idle'}
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              Target: <code className="font-mono font-semibold">/{activeRoute}</code>
            </div>
          </div>
          <div className="relative rounded-xl border-2 border-slate-900 bg-white p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <span className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                  Gearbox Proxy
                </span>
              </div>
              <span className="rounded bg-indigo-100 px-1.5 py-0.5 font-mono text-[10px] font-black text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                PORT 3000
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-zinc-400">
              EWMA Cost Evaluator routing to <span className="font-bold">Tier {currentTier}</span>
            </p>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-zinc-800">
              <span>Hysteresis Lock</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                15s Cooldown
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            2. Caching Layer
          </div>
          <div
            className={`relative rounded-xl border-2 p-4 transition-all duration-500 ${
              isRedisActive
                ? doesRouteHitRedis && isRunning
                  ? 'border-amber-500 bg-amber-50/70 shadow-[3px_3px_0px_0px_rgba(245,158,11,1)] dark:bg-amber-950/30'
                  : 'border-slate-900 bg-amber-50/30 dark:border-zinc-600 dark:bg-zinc-900'
                : 'border-dashed border-slate-300 bg-slate-50/50 opacity-50 dark:border-zinc-800 dark:bg-zinc-900/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap
                  className={`h-5 w-5 ${
                    isRedisActive ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
                  }`}
                />
                <span className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                  Redis Cloud
                </span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                  isRedisActive
                    ? 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200'
                    : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
              >
                {isRedisActive ? 'UNLOCKED (T5-1)' : 'NULL CACHE (T6)'}
              </span>
            </div>

            <p className="mt-2 text-xs text-slate-600 dark:text-zinc-400">
              {isRedisActive
                ? doesRouteHitRedis
                  ? '⚡ Active Cache Hit: Bypassing Postgres Read Disk'
                  : 'Standby for Products & Order detail queries'
                : 'Bypassed in Tier 6: All queries hit Postgres directly'}
            </p>

            {isRedisActive && (
              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                TTL: 300s Invalidation
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            3. Database Tier
          </div>
          <div
            className={`relative rounded-xl border-2 p-4 transition-all duration-300 ${
              doesRouteHitPrimary && isRunning
                ? 'border-blue-500 bg-blue-50/50 shadow-[2px_2px_0px_0px_rgba(59,130,246,1)] dark:bg-blue-950/20'
                : 'border-slate-900 bg-white dark:border-zinc-700 dark:bg-zinc-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                  Postgres Primary
                </span>
              </div>
              <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                PORT 5432
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-zinc-400">
              Primary Master for ACID transactions, Inventory row locks, and UUIDv7 orders.
            </p>
          </div>
          <div
            className={`relative rounded-xl border-2 p-4 transition-all duration-500 ${
              isReplicaActive
                ? doesRouteHitReplica && isRunning
                  ? 'border-emerald-500 bg-emerald-50/70 shadow-[3px_3px_0px_0px_rgba(16,185,129,1)] dark:bg-emerald-950/30'
                  : 'border-slate-900 bg-emerald-50/30 dark:border-zinc-600 dark:bg-zinc-900'
                : 'border-dashed border-slate-300 bg-slate-50/50 opacity-50 dark:border-zinc-800 dark:bg-zinc-900/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitFork
                  className={`h-5 w-5 ${
                    isReplicaActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                  }`}
                />
                <span className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                  Read Replica
                </span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                  isReplicaActive
                    ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200'
                    : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
              >
                {isReplicaActive ? 'ACTIVE (T5-1)' : 'STANDBY (T6)'}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-zinc-400">
              {isReplicaActive
                ? 'Read-splitting active: Offloads catalog & order queries from Primary'
                : 'Disabled in Tier 6: All read queries hit Primary Master'}
            </p>
          </div>
        </div>

        {/* Column 4: Async Queue & Background Processing (Kafka & Worker) */}
        <div className="flex flex-col gap-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            4. Async Pipeline
          </div>
          <div
            className={`relative rounded-xl border-2 p-4 transition-all duration-500 ${
              isKafkaActive
                ? doesRouteHitKafka && isRunning
                  ? 'border-purple-500 bg-purple-50/70 shadow-[3px_3px_0px_0px_rgba(168,85,247,1)] dark:bg-purple-950/30'
                  : 'border-slate-900 bg-purple-50/30 dark:border-zinc-600 dark:bg-zinc-900'
                : 'border-dashed border-slate-300 bg-slate-50/50 opacity-50 dark:border-zinc-800 dark:bg-zinc-900/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio
                  className={`h-5 w-5 ${
                    isKafkaActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'
                  }`}
                />
                <span className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                  Kafka Cluster
                </span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                  isKafkaActive
                    ? 'bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-200'
                    : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                }`}
              >
                {isKafkaActive ? 'STREAMING (T3-1)' : 'NULL (T6-4)'}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-zinc-400">
              {isKafkaActive
                ? 'Topics: order.created, emails.dispatch. Ingestion decoupled from HTTP response.'
                : 'Bypassed in Tiers 6-4: Direct synchronous execution'}
            </p>
          </div>

          {/* Email Dispatch Worker */}
          <div
            className={`relative rounded-xl border-2 p-4 transition-all duration-500 ${
              isWorkerAsync
                ? 'border-slate-900 bg-purple-50/20 dark:border-zinc-700 dark:bg-zinc-900'
                : 'border-amber-400 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail
                  className={`h-5 w-5 ${
                    isWorkerAsync ? 'text-purple-600 dark:text-purple-400' : 'text-amber-600'
                  }`}
                />
                <span className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                  Email Dispatch
                </span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                  isWorkerAsync
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200'
                }`}
              >
                {isWorkerAsync ? 'ASYNC CONSUMER' : 'SYNC (25ms BLOCK)'}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-zinc-400">
              {isWorkerAsync
                ? 'Worker polls Kafka consumer group; 0ms added to client order latency'
                : 'Artificial 25ms delay injected synchronously into client request in Tier 6-4'}
            </p>
          </div>
        </div>
      </div>

      {/* Active Tier Summary Bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-slate-900 bg-slate-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-zinc-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>Active Architecture Mode:</span>
          <span className="font-mono font-bold text-slate-900 dark:text-zinc-100">
            {getTierDescription(currentTier)}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400">Circuit Breakers:</span>
          <span className="flex items-center gap-1 font-mono font-bold text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            CLOSED (Healthy)
          </span>
        </div>
      </div>
    </div>
  );
}
