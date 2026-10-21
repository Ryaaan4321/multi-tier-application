INSERT INTO products (id, name, description, price_cents, stock_quantity)
VALUES
  ('0192e2b0-8e10-7000-8000-000000000001', 'Mechanical Keyboard', 'Compact mechanical keyboard with brown switches', 8999, 500),
  ('0192e2b0-8e10-7000-8000-000000000002', 'Wireless Gaming Mouse', 'Ultra-lightweight wireless optical mouse', 5999, 1000),
  ('0192e2b0-8e10-7000-8000-000000000003', '4K USB-C Monitor', '27-inch 4K IPS display with power delivery', 34999, 150),
  ('0192e2b0-8e10-7000-8000-000000000004', 'Noise-Cancelling Headphones', 'Over-ear Bluetooth headphones with ANC', 19999, 300),
  ('0192e2b0-8e10-7000-8000-000000000005', 'USB-C Aluminum Dock', '10-in-1 multi-port hub with dual HDMI', 4999, 800)
ON CONFLICT (id) DO NOTHING;
