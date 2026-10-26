import { describe, it, expect } from 'vitest';
import { SlidingWindowCounter } from '../src/engine/sliding-window.js';

describe('SlidingWindowCounter (Bucketed Ring Buffer)', () => {
  it('accumulates costs occurring within the same second', () => {
    const window = new SlidingWindowCounter(10);
    const baseTime = 1700000000000;

    window.add(1, baseTime);
    window.add(15, baseTime + 200);
    window.add(3, baseTime + 800);

    expect(window.getScore(baseTime + 900)).toBe(19);
  });

  it('aggregates costs across multiple seconds within the rolling window', () => {
    const window = new SlidingWindowCounter(10);
    const baseTime = 1700000000000;

    window.add(10, baseTime);
    window.add(20, baseTime + 2000);
    window.add(30, baseTime + 5000);

    expect(window.getScore(baseTime + 6000)).toBe(60);
  });

  it('drops buckets that are older than the window size', () => {
    const window = new SlidingWindowCounter(10);
    const baseTime = 1700000000000;

    window.add(100, baseTime);
    window.add(20, baseTime + 5000);

    expect(window.getScore(baseTime + 11000)).toBe(20);
  });

  it('returns zero if all recorded traffic is older than the window size', () => {
    const window = new SlidingWindowCounter(10);
    const baseTime = 1700000000000;

    window.add(500, baseTime);

    expect(window.getScore(baseTime + 15000)).toBe(0);
  });

  it('resets all buckets completely on reset()', () => {
    const window = new SlidingWindowCounter(10);
    const baseTime = 1700000000000;

    window.add(100, baseTime);
    window.reset();

    expect(window.getScore(baseTime)).toBe(0);
  });
});
