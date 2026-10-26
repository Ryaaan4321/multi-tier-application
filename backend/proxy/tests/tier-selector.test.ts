import { describe, it, expect } from 'vitest';
import { selectTier, TierThreshold } from '../src/engine/tier-selector.js';

describe('Tier Selector Pure Function', () => {
  const sampleThresholds: Record<number, TierThreshold> = {
    6: { up: 250, down: 0 },
    5: { up: 500, down: 150 },
    4: { up: 1000, down: 350 },
    3: { up: 2000, down: 750 },
    2: { up: 4000, down: 1500 },
    1: { up: 999999, down: 3000 }
  };

  const defaultCooldownMs = 15000;

  it('maintains the current tier when the load score is within the deadband', () => {
    const result = selectTier({
      currentTier: 5,
      loadScore: 300,
      lastSwitchTimestamp: 1000,
      currentTimestamp: 20000,
      cooldownPeriodMs: defaultCooldownMs,
      thresholds: sampleThresholds
    });

    expect(result.nextTier).toBe(5);
    expect(result.didSwitch).toBe(false);
    expect(result.reason).toContain('within_stable_deadband');
  });

  it('switches up to Tier 5 when Tier 6 load score exceeds the up threshold', () => {
    const result = selectTier({
      currentTier: 6,
      loadScore: 260,
      lastSwitchTimestamp: 1000,
      currentTimestamp: 5000,
      cooldownPeriodMs: defaultCooldownMs,
      thresholds: sampleThresholds
    });

    expect(result.nextTier).toBe(5);
    expect(result.didSwitch).toBe(true);
    expect(result.reason).toContain('exceeded_up_threshold_250');
  });

  it('blocks demotion if load score drops below threshold but cooldown timer is still active', () => {
    const result = selectTier({
      currentTier: 5,
      loadScore: 100,
      lastSwitchTimestamp: 10000,
      currentTimestamp: 15000,
      cooldownPeriodMs: defaultCooldownMs,
      thresholds: sampleThresholds
    });

    expect(result.nextTier).toBe(5);
    expect(result.didSwitch).toBe(false);
    expect(result.reason).toContain('cooldown_active');
  });

  it('permits demotion to Tier 6 when load drops and cooldown period has fully elapsed', () => {
    const result = selectTier({
      currentTier: 5,
      loadScore: 120,
      lastSwitchTimestamp: 10000,
      currentTimestamp: 30000,
      cooldownPeriodMs: defaultCooldownMs,
      thresholds: sampleThresholds
    });

    expect(result.nextTier).toBe(6);
    expect(result.didSwitch).toBe(true);
    expect(result.reason).toContain('dropped_below_down_threshold_150');
  });

  it('does not upgrade beyond maximum tier (Tier 1)', () => {
    const result = selectTier({
      currentTier: 1,
      loadScore: 9999999,
      lastSwitchTimestamp: 1000,
      currentTimestamp: 50000,
      cooldownPeriodMs: defaultCooldownMs,
      thresholds: sampleThresholds,
      maxTier: 1
    });

    expect(result.nextTier).toBe(1);
    expect(result.didSwitch).toBe(false);
  });

  it('does not downgrade beyond minimum tier (Tier 6)', () => {
    const result = selectTier({
      currentTier: 6,
      loadScore: 0,
      lastSwitchTimestamp: 1000,
      currentTimestamp: 50000,
      cooldownPeriodMs: defaultCooldownMs,
      thresholds: sampleThresholds,
      minTier: 6
    });

    expect(result.nextTier).toBe(6);
    expect(result.didSwitch).toBe(false);
  });
});
