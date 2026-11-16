-- «Yo'q» (owner's decision, November 2026): until «Tayyor» the owner takes out a line the shop
-- did not have. The line stays, marked, so the customer and the owner see what was missing; the
-- order's sums are rewritten. A paid transfer owes the difference back until «Qaytardim».
-- Additive: the previous Worker names its columns and never reads these.
ALTER TABLE order_items ADD COLUMN removed_at INTEGER;
ALTER TABLE orders ADD COLUMN refund_owed INTEGER NOT NULL DEFAULT 0;
-- «Pul» → «Qaytarish»: only the orders with a part owed back, never the shop's history.
CREATE INDEX idx_orders_refund_owed ON orders (business_id, number) WHERE refund_owed > 0;
