import { z } from 'zod';

export const createOrderBodySchema = z.object({
  customerEmail: z.string().email(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1)
      })
    )
    .min(1, 'Order must contain at least one item')
});

export const orderIdParamSchema = z.object({
  id: z.string().uuid()
});

export const idempotencyHeaderSchema = z.object({
  'idempotency-key': z.string().min(1, 'Idempotency-Key header is required')
});

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
export type OrderIdParam = z.infer<typeof orderIdParamSchema>;
