import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

async function main(): Promise<void> {
  for (const product of initialProducts) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {},
      create: product
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
