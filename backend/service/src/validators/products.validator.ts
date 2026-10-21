import { z } from 'zod';

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const productIdParamSchema = z.object({
  id: z.string().uuid()
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type ProductIdParam = z.infer<typeof productIdParamSchema>;
