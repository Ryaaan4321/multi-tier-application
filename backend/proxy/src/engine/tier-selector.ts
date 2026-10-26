export interface TierThreshold {
  up: number;
  down: number;
}

export interface TierSelectionInput {
  currentTier: number;
  loadScore: number;
  lastSwitchTimestamp: number;
  currentTimestamp: number;
  cooldownPeriodMs: number;
  thresholds: Record<number, TierThreshold>;
  minTier?: number;
  maxTier?: number;
}

export interface TierSelectionResult {
  nextTier: number;
  didSwitch: boolean;
  reason: string;
}

export function selectTier(input: TierSelectionInput): TierSelectionResult {
  const minTier = input.minTier ?? 6;
  const maxTier = input.maxTier ?? 1;
  const current = input.currentTier;
  const currentConfig = input.thresholds[current];

  if (!currentConfig) {
    return {
      nextTier: current,
      didSwitch: false,
      reason: `no_threshold_configuration_for_tier_${current}`
    };
  }

  const timeSinceLastSwitch = input.currentTimestamp - input.lastSwitchTimestamp;
  const isInCooldown = timeSinceLastSwitch < input.cooldownPeriodMs;

  if (current > maxTier && input.loadScore >= currentConfig.up) {
    const targetTier = current - 1;
    return {
      nextTier: targetTier,
      didSwitch: true,
      reason: `load_score_${input.loadScore}_exceeded_up_threshold_${currentConfig.up}`
    };
  }

  if (current < minTier && input.loadScore < currentConfig.down) {
    if (isInCooldown) {
      return {
        nextTier: current,
        didSwitch: false,
        reason: `cooldown_active_${timeSinceLastSwitch}ms_less_than_${input.cooldownPeriodMs}ms`
      };
    }

    const targetTier = current + 1;
    return {
      nextTier: targetTier,
      didSwitch: true,
      reason: `load_score_${input.loadScore}_dropped_below_down_threshold_${currentConfig.down}`
    };
  }

  return {
    nextTier: current,
    didSwitch: false,
    reason: `load_score_${input.loadScore}_within_stable_deadband`
  };
}
