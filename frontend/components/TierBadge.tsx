'use client';

interface TierBadgeProps {
  tier: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const TIER_META: Record<
  number,
  { label: string; desc: string; bg: string; text: string; border: string; ring: string }
> = {
  6: {
    label: 'GEAR 6',
    desc: 'Naive Baseline (Direct DB, Synchronous Email)',
    bg: 'bg-zinc-100 dark:bg-zinc-800',
    text: 'text-zinc-800 dark:text-zinc-200',
    border: 'border-zinc-400 dark:border-zinc-600',
    ring: 'ring-zinc-400'
  },
  5: {
    label: 'GEAR 5',
    desc: 'Cached & Split (Redis Active + Read Replica)',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-400 dark:border-blue-600',
    ring: 'ring-blue-400'
  },
  4: {
    label: 'GEAR 4',
    desc: 'Sharded Storage (Dual Shards + Redis)',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-400 dark:border-indigo-600',
    ring: 'ring-indigo-400'
  },
  3: {
    label: 'GEAR 3',
    desc: 'Event-Driven (Kafka Queue + Async Worker)',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-400 dark:border-purple-600',
    ring: 'ring-purple-400'
  },
  2: {
    label: 'GEAR 2',
    desc: 'High Scale (Full Resiliency Stack)',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-400 dark:border-amber-600',
    ring: 'ring-amber-400'
  },
  1: {
    label: 'GEAR 1',
    desc: 'Maximum Throughput (Critical Survival Mode)',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-400 dark:border-rose-600',
    ring: 'ring-rose-400'
  }
};

export function TierBadge({ tier, className = '', size = 'md' }: TierBadgeProps) {
  const meta = TIER_META[tier] || TIER_META[6];

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 border',
    md: 'text-xs px-2.5 py-1 border-2 font-mono font-bold',
    lg: 'text-sm px-3.5 py-1.5 border-2 font-mono font-black'
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full transition-all duration-300 ${sizeClasses} ${meta.bg} ${meta.text} ${meta.border} ${className}`}
      title={meta.desc}
    >
      <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
      <span>{meta.label}</span>
    </span>
  );
}

export function getTierDescription(tier: number): string {
  return TIER_META[tier]?.desc || TIER_META[6].desc;
}
