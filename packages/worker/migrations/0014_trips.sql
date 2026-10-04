-- Trips (owner's decision, October 2026): several orders of one shop going one way, with one
-- courier, stops in order and the way along the roads. Additive: the previous Worker never reads
-- these and keeps assigning orders one by one.
CREATE TABLE trips (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id),
    courier_id TEXT NOT NULL,
    -- The way along the roads, JSON [[lng, lat], ...]; NULL: the app draws straight lines.
    route TEXT,
    distance_m INTEGER,
    duration_s INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_trips_business ON trips (business_id, created_at);
CREATE INDEX idx_trips_courier ON trips (courier_id, created_at);

-- The order's trip and its stop there (1, 2, 3 ...).
ALTER TABLE orders ADD COLUMN trip_id TEXT;
ALTER TABLE orders ADD COLUMN trip_stop INTEGER;
CREATE INDEX idx_orders_trip ON orders (trip_id, trip_stop);
