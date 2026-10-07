-- Demo shops («Namuna»): a live shop a platform admin made a demo. Reached only by its bot link,
-- never in the showcase or the district network, with a test card; its orders are not real.
-- Additive: the previous Worker never reads it.
ALTER TABLE businesses ADD COLUMN demo_at INTEGER;
