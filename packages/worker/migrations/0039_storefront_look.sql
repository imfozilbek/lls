-- How a shop looks to its customers, and its number (owner's decisions, November 2026; goal 24).
-- Additive: the previous Worker names its columns and never reads these.

-- «Vitrina qanday ko'rinadi»: grid, list, feed or shelves; NULL: never chosen, the app decides by
-- the photos. No CHECK: another layout stays one more value (SQLite changes a CHECK only by
-- rebuilding the table); the Worker refuses anything else.
ALTER TABLE businesses ADD COLUMN storefront_layout TEXT;

-- «Muqova rasmi»: the wide picture over the storefront, an R2 key under shops/<id>/cover/;
-- NULL: none.
ALTER TABLE businesses ADD COLUMN cover_key TEXT;

-- «Raqamni mijozlarga ko'rsatmaslik»: customers miss the shop's number while its support group
-- answers them; couriers always see it; without the group it shows again by itself.
ALTER TABLE businesses ADD COLUMN phone_hidden INTEGER NOT NULL DEFAULT 0;
