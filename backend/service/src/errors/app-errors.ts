export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  readonly isOperational: boolean = true;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  constructor(message: string, public readonly details?: unknown) {
    super(message);
  }
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
}

export class InsufficientStockError extends AppError {
  readonly statusCode = 422;
  constructor(public readonly productId: string, public readonly available: number, public readonly requested: number) {
    super(`Insufficient stock for product ${productId}. Available: ${available}, requested: ${requested}`);
  }
}

export class IdempotencyConflictError extends AppError {
  readonly statusCode = 409;
  constructor(idempotencyKey: string) {
    super(`A conflicting request with idempotency key '${idempotencyKey}' is currently processing or failed.`);
  }
}
