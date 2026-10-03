-- The screenshot of the transfer the customer attaches to «Я перевёл» (kept privately in R2),
-- and what the owner should know before trusting it. Additive only: old rows read as no receipt.
ALTER TABLE orders ADD COLUMN receipt_key TEXT;
ALTER TABLE orders ADD COLUMN receipt_hash TEXT;
ALTER TABLE orders ADD COLUMN receipt_at INTEGER;
-- The same picture came with an earlier order: its number in this shop, 0 for another shop.
ALTER TABLE orders ADD COLUMN receipt_reused_from INTEGER;
-- Transfers of this customer that owners did not find, counted when this receipt came.
ALTER TABLE orders ADD COLUMN customer_rejections INTEGER NOT NULL DEFAULT 0;
-- «Pul kelmadi» on this order.
ALTER TABLE orders ADD COLUMN transfer_rejections INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_receipt_hash ON orders (receipt_hash)
    WHERE receipt_hash IS NOT NULL;
