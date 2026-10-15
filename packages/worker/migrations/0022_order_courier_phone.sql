-- Everyone on an order can call each other (owner's decision, October 2026): the courier's phone
-- is kept with the order when a courier takes it, like their name. Additive: the previous Worker
-- never reads it.
ALTER TABLE orders ADD COLUMN courier_phone TEXT;
