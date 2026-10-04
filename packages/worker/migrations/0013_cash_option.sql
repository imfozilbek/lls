-- Cash as a way of paying, chosen by the shop: card (as before), cash or both.
-- Additive: the previous Worker never reads these columns and keeps taking transfers only.
ALTER TABLE businesses ADD COLUMN payment_options TEXT NOT NULL DEFAULT 'card';

-- The shop has a cash order's money: the owner took it from the courier, or delivered it.
ALTER TABLE orders ADD COLUMN cash_received_at INTEGER;

-- Cash orders paid before transfers became the only way are settled history, never a debt.
UPDATE orders SET cash_received_at = COALESCE(paid_at, delivered_at, created_at)
WHERE payment_method = 'cash' AND payment_status = 'paid';

-- What a courier still holds (the courier screen); per shop it is idx_orders_cash_courier.
CREATE INDEX idx_orders_cash_held ON orders (cash_courier_id, cash_received_at);
