-- Kinds of business (owner's decision, October 2026): grocery store, restaurant (`food`), service.
-- A water shop is a grocery store with the bottle deposit: its features (bottles, reorder) stay.
UPDATE businesses SET type = 'grocery' WHERE type = 'water';

-- Small settings of the platform itself, kept by the deploy (for example, which avatar file each
-- Zumda bot already wears, so a deploy sets a picture only when it changed).
CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
