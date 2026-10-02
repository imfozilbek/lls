-- Money: how each order is paid, the cash couriers hold and hand over, the shop's card.
-- Additive only: the Worker before this migration keeps working on the new schema.

ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash';
ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE orders ADD COLUMN paid_at INTEGER;
-- The courier who took the cash at the door.
ALTER TABLE orders ADD COLUMN cash_courier_id TEXT REFERENCES couriers (id);
ALTER TABLE orders ADD COLUMN delivered_at INTEGER;

-- The money report reads by delivery time; open payments by payment status.
CREATE INDEX idx_orders_business_delivered ON orders (business_id, delivered_at);
CREATE INDEX idx_orders_business_payment ON orders (business_id, payment_status, number);
CREATE INDEX idx_orders_cash_courier ON orders (business_id, cash_courier_id);

-- The card customers transfer to; NULL = cash only. Not a secret: customers see it.
ALTER TABLE businesses ADD COLUMN payout_card_number TEXT;
ALTER TABLE businesses ADD COLUMN payout_card_holder TEXT;

-- Cash a courier gave to the owner.
CREATE TABLE cash_handovers (
    id           TEXT PRIMARY KEY,
    business_id  TEXT    NOT NULL REFERENCES businesses (id),
    courier_id   TEXT    NOT NULL REFERENCES couriers (id),
    amount       INTEGER NOT NULL,
    at           INTEGER NOT NULL
);
CREATE INDEX idx_cash_handovers_courier ON cash_handovers (business_id, courier_id, at);
