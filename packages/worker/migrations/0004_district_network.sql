-- District delivery, part 2: the district network (goal 06).
-- Additive only: the old Worker keeps working on this schema.

-- A district of the network: a circle around its center. The admin sets it in the Zumda bot.
CREATE TABLE districts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    radius_m INTEGER NOT NULL,
    -- A network order waiting longer than this is reported to the shop and the admins.
    wait_minutes INTEGER NOT NULL DEFAULT 10,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- The district the shop's location falls in (recomputed when the shop or a district moves).
ALTER TABLE businesses ADD COLUMN district_id TEXT REFERENCES districts (id);
-- When its own couriers are busy, orders go to the district network. On by default.
ALTER TABLE businesses ADD COLUMN network_delivery INTEGER NOT NULL DEFAULT 1;
CREATE INDEX idx_businesses_district ON businesses (district_id);

-- The courier's own consent to deliver for other shops of the district.
ALTER TABLE courier_profiles ADD COLUMN in_network INTEGER NOT NULL DEFAULT 0;
ALTER TABLE courier_profiles ADD COLUMN network_offered_at INTEGER;
CREATE INDEX idx_courier_profiles_network ON courier_profiles (in_network, shift_until);

-- Asked of the network at this moment; null once the shop's own courier takes it.
ALTER TABLE orders ADD COLUMN network_requested_at INTEGER;
-- The shop and admins were told nobody took it in time.
ALTER TABLE orders ADD COLUMN network_alerted_at INTEGER;
-- Who gets the delivery fee: a snapshot fixed when a courier takes the order.
ALTER TABLE orders ADD COLUMN delivery_fee_to TEXT NOT NULL DEFAULT 'business';
CREATE INDEX idx_orders_network_waiting ON orders (network_requested_at)
    WHERE network_requested_at IS NOT NULL AND courier_id IS NULL;

-- «Новый заказ рядом» messages, so they change to «Уже взяли» when someone takes the order.
CREATE TABLE network_offers (
    order_id TEXT NOT NULL REFERENCES orders (id),
    telegram_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (order_id, telegram_id)
);
