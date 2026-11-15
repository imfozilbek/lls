-- A shop's courier may be a dispatcher (owner's decision, November 2026): the owner packs, the
-- dispatcher sends the parcel on by a taxi, the post or someone else and writes notes the
-- customer sees. The carrier is never stored, only the way and the notes.
-- `couriers.dispatcher`: this link is the shop's dispatcher (1) or a rider (0).
-- `orders.dispatcher`: the order was handed to a dispatcher (a snapshot, like courier_name).
-- `orders.owner_delivers`: «O'zim yetkazaman», the owner delivers it.
-- `orders.sent_via`: «Jo'natdim»: self, taxi, post or other (NULL: not sent by a dispatcher).
-- `orders.delivery_notes`: the dispatcher's notes, a JSON array of {at, text} (NULL: none).
-- `customer_pays_carrier`: «Yetkazish haqini mijoz o'zi to'laydi» for the shop, and its snapshot
-- in each order. Additive: the previous Worker names its columns and never reads these.
ALTER TABLE couriers ADD COLUMN dispatcher INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN dispatcher INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN owner_delivers INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN sent_via TEXT;
ALTER TABLE orders ADD COLUMN delivery_notes TEXT;
ALTER TABLE orders ADD COLUMN customer_pays_carrier INTEGER NOT NULL DEFAULT 0;
ALTER TABLE businesses ADD COLUMN customer_pays_carrier INTEGER NOT NULL DEFAULT 0;
