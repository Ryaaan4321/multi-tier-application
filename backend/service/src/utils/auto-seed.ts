import { PrismaClient } from '@prisma/client';
import { Logger } from 'pino';

const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS "products" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "price_cents" INTEGER NOT NULL,
    "stock_quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "orders" (
    "id" UUID NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "customer_email" VARCHAR(255) NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "products_created_at_idx" ON "products"("created_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "orders_idempotency_key_key" ON "orders"("idempotency_key");
CREATE INDEX IF NOT EXISTS "orders_customer_email_idx" ON "orders"("customer_email");
CREATE INDEX IF NOT EXISTS "orders_created_at_idx" ON "orders"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items"("order_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'order_items_order_id_fkey'
    ) THEN
        ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" 
        FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
`;

export async function autoSeedProductsIfEmpty(prisma: PrismaClient, logger: Logger): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(SCHEMA_DDL);
    logger.info('Database schema verified/created');

    const count = await prisma.product.count();
    if (count > 0) {
      logger.info({ count }, 'Product catalog already seeded');
      return;
    }

    logger.info('Database empty: auto-seeding initial product catalog');
    const initialProducts = [
      {
        id: '0192e2b0-8e10-7000-8000-000000000001',
        name: 'Mechanical Keyboard',
        description: 'Compact mechanical keyboard with brown switches',
        priceCents: 8999,
        stockQuantity: 500
      },
      {
        id: '0192e2b0-8e10-7000-8000-000000000002',
        name: 'Wireless Gaming Mouse',
        description: 'Ultra-lightweight wireless optical mouse',
        priceCents: 5999,
        stockQuantity: 1000
      },
      {
        id: '0192e2b0-8e10-7000-8000-000000000003',
        name: '4K USB-C Monitor',
        description: '27-inch 4K IPS display with power delivery',
        priceCents: 34999,
        stockQuantity: 150
      },
      {
        id: '0192e2b0-8e10-7000-8000-000000000004',
        name: 'Noise-Cancelling Headphones',
        description: 'Over-ear Bluetooth headphones with ANC',
        priceCents: 19999,
        stockQuantity: 300
      },
      {
        id: '0192e2b0-8e10-7000-8000-000000000005',
        name: 'USB-C Aluminum Dock',
        description: '10-in-1 multi-port hub with dual HDMI',
        priceCents: 4999,
        stockQuantity: 800
      }
    ];

    for (const product of initialProducts) {
      await prisma.product.upsert({
        where: { id: product.id },
        update: {},
        create: product
      });
    }
    logger.info('Product catalog auto-seeded successfully');
  } catch (err) {
    logger.warn({ err }, 'Auto-seed failed');
  }
}

