-- Goal 17: variants and add-ons. A product keeps its variants (one is picked, each with its own
-- price) and add-ons as JSON; an order line keeps the customer's pick (ids and words) as JSON.
-- Additive only: the old Worker never reads these columns.
ALTER TABLE products ADD COLUMN options TEXT;
ALTER TABLE order_items ADD COLUMN options TEXT;
