-- District delivery, part 1: one courier profile per person, couriers bot.
-- Additive only: the old Worker keeps working on this schema.
--
-- `couriers` rows stay as they are and become the link "a person works for a shop":
-- orders, cash and handovers keep pointing at them, so each shop's money stays separate.

-- One row per person, whatever shops they deliver for.
CREATE TABLE courier_profiles (
    telegram_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    -- "Damas", "Nexia", "moto": what the courier drives.
    vehicle TEXT,
    -- On shift until this moment (the end of the local day the shift started).
    shift_until INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- pending: accepted the invite, waits for the owner; active: approved; removed: declined or removed.
ALTER TABLE couriers ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
-- The owner's week for this courier, Monday first.
ALTER TABLE couriers ADD COLUMN work_days TEXT NOT NULL DEFAULT 'mon,tue,wed,thu,fri,sat,sun';
-- "Сегодня не работает" until this moment.
ALTER TABLE couriers ADD COLUMN off_until INTEGER;

UPDATE couriers SET status = 'removed' WHERE is_active = 0;

-- A profile for everyone who is a courier today: the name of their latest record...
INSERT OR IGNORE INTO courier_profiles (telegram_id, name, phone, created_at, updated_at)
SELECT c.telegram_id, c.name, c.phone, c.created_at, c.updated_at
FROM couriers c
WHERE c.updated_at = (SELECT MAX(d.updated_at) FROM couriers d WHERE d.telegram_id = c.telegram_id);

-- ...and a phone from any of their records.
UPDATE courier_profiles SET phone = (
    SELECT c.phone FROM couriers c
    WHERE c.telegram_id = courier_profiles.telegram_id AND c.phone IS NOT NULL
    ORDER BY c.updated_at DESC LIMIT 1
)
WHERE phone IS NULL;

CREATE INDEX idx_couriers_business_status ON couriers (business_id, status);
