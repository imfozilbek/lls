-- The shop's stock (owner's decision, November 2026): what is left of a product when the owner
-- counts it, in the order's base units (pieces, or grams for weight units). NULL: not counted,
-- sold as before. It never goes below zero: an order that would take more than is left fails as
-- a whole, so two customers never get the last piece.
-- Additive: the previous Worker names its columns and never reads or writes these.
ALTER TABLE products ADD COLUMN stock INTEGER CHECK (stock IS NULL OR stock >= 0);
-- The line took its quantity from the counted stock: a cancel gives exactly that back.
ALTER TABLE order_items ADD COLUMN from_stock INTEGER;
