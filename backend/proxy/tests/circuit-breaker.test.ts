import { describe, it, expect } from 'vitest';
import { TierCircuitBreaker } from '../src/forwarder/circuit-breaker.js';

describe('TierCircuitBreaker State Machine', () => {
  it('starts in CLOSED state and permits execution', () => {
    const breaker = new TierCircuitBreaker({ failureThreshold: 3, recoveryTimeoutMs: 5000 });
    expect(breaker.getState()).toBe('CLOSED');
    expect(breaker.canExecute()).toBe(true);
  });

  it('trips to OPEN when failures reach the threshold', () => {
    const breaker = new TierCircuitBreaker({ failureThreshold: 3, recoveryTimeoutMs: 5000 });

    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe('CLOSED');

    breaker.recordFailure();
    expect(breaker.getState()).toBe('OPEN');
    expect(breaker.canExecute()).toBe(false);
  });

  it('rejects execution while recovery timeout is active', () => {
    const breaker = new TierCircuitBreaker({ failureThreshold: 2, recoveryTimeoutMs: 5000 });
    const now = 100000;

    breaker.recordFailure(now);
    breaker.recordFailure(now);
    expect(breaker.getState()).toBe('OPEN');

    expect(breaker.canExecute(now + 2000)).toBe(false);
  });

  it('transitions to HALF-OPEN after recovery timeout elapses', () => {
    const breaker = new TierCircuitBreaker({ failureThreshold: 2, recoveryTimeoutMs: 5000 });
    const now = 100000;

    breaker.recordFailure(now);
    breaker.recordFailure(now);

    expect(breaker.canExecute(now + 5001)).toBe(true);
    expect(breaker.getState()).toBe('HALF-OPEN');
  });

  it('resets to CLOSED when request succeeds in HALF-OPEN state', () => {
    const breaker = new TierCircuitBreaker({ failureThreshold: 2, recoveryTimeoutMs: 5000 });
    const now = 100000;

    breaker.recordFailure(now);
    breaker.recordFailure(now);
    breaker.canExecute(now + 5001);

    breaker.recordSuccess();
    expect(breaker.getState()).toBe('CLOSED');
    expect(breaker.getFailureCount()).toBe(0);
  });

  it('immediately returns to OPEN if probe fails in HALF-OPEN state', () => {
    const breaker = new TierCircuitBreaker({ failureThreshold: 2, recoveryTimeoutMs: 5000 });
    const now = 100000;

    breaker.recordFailure(now);
    breaker.recordFailure(now);
    breaker.canExecute(now + 5001);

    breaker.recordFailure(now + 5002);
    expect(breaker.getState()).toBe('OPEN');
    expect(breaker.canExecute(now + 5003)).toBe(false);
  });
});
