export interface Product {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  stockQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPriceCents: number;
  createdAt: Date;
}

export interface Order {
  id: string;
  idempotencyKey: string;
  customerEmail: string;
  totalCents: number;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
  items?: OrderItem[];
}

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  idempotencyKey: string;
  customerEmail: string;
  items: CreateOrderItemInput[];
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}
