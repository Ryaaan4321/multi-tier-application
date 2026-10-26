export interface Bucket {
  second: number;
  cost: number;
}
export class SlidingWindowCounter {
  private buckets: Bucket[];
  private readonly windowSizeSeconds: number;
  constructor(windowSizeSeconds: number = 10) {
    this.windowSizeSeconds = windowSizeSeconds;
    this.buckets = Array.from({ length: windowSizeSeconds }, () => ({
      second: 0,
      cost: 0
    }));
  }
  add(cost: number, timestampMs: number = Date.now()): void {
    const second = Math.floor(timestampMs / 1000);
    const index = Math.abs(second % this.windowSizeSeconds);
    const bucket = this.buckets[index];
    if (bucket.second === second) {
      bucket.cost += cost;
    } else {
      bucket.second = second;
      bucket.cost = cost;
    }
  }

  getScore(timestampMs: number = Date.now()): number {
    const currentSecond = Math.floor(timestampMs / 1000);
    let totalScore = 0;
    for (let i = 0; i < this.windowSizeSeconds; i++) {
      const bucket = this.buckets[i];
      const ageSeconds = currentSecond - bucket.second;
      if (ageSeconds >= 0 && ageSeconds < this.windowSizeSeconds) {
        totalScore += bucket.cost;
      }
    }
    return totalScore;
  }

  reset(): void {
    for (let i = 0; i < this.windowSizeSeconds; i++) {
      this.buckets[i].second = 0;
      this.buckets[i].cost = 0;
    }
  }
}
