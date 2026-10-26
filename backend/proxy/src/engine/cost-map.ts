export interface RouteCostRule {
  method: string;
  pattern: RegExp;
  cost: number;
}

export class RouteCostEvaluator {
  private rules: RouteCostRule[];
  private defaultCost: number;
  constructor(defaultCost: number = 1) {
    this.defaultCost = defaultCost;
    this.rules = [
      { method: 'GET', pattern: /^\/health\/?$/, cost: 0 },
      { method: 'GET', pattern: /^\/ready\/?$/, cost: 0 },
      { method: 'GET', pattern: /^\/metrics\/?$/, cost: 0 },
      { method: 'GET', pattern: /^\/api\/v1\/products\/?$/, cost: 1 },
      { method: 'GET', pattern: /^\/api\/v1\/products\/[a-zA-Z0-9-]+\/?$/, cost: 3 },
      { method: 'POST', pattern: /^\/api\/v1\/orders\/?$/, cost: 15 },
      { method: 'GET', pattern: /^\/api\/v1\/orders\/?$/, cost: 5 },
      { method: 'GET', pattern: /^\/api\/v1\/orders\/[a-zA-Z0-9-]+\/?$/, cost: 3 }
    ];
  }
  evaluate(method: string, url: string): number {
    const path = url.split('?')[0];
    const upperMethod = method.toUpperCase();
    for (const rule of this.rules) {
      if (rule.method === upperMethod && rule.pattern.test(path)) {
        return rule.cost;
      }
    }
    return this.defaultCost;
  }
}
