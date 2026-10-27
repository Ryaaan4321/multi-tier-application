export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF-OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeoutMs?: number;
}

export class TierCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly failureThreshold: number;
  private readonly recoveryTimeoutMs: number;
  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.recoveryTimeoutMs = options.recoveryTimeoutMs ?? 10000;
  }
  canExecute(now: number = Date.now()): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }
    if (this.state === 'OPEN') {
      if (now - this.lastFailureTime >= this.recoveryTimeoutMs) {
        this.state = 'HALF-OPEN';
        return true;
      }
      return false;
    }
    return true;
  }
  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  recordFailure(now: number = Date.now()): void {
    this.failureCount++;
    this.lastFailureTime = now;
    if (this.state === 'HALF-OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
  getState(): CircuitState {
    return this.state;
  }
  getFailureCount(): number {
    return this.failureCount;
  }
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}
