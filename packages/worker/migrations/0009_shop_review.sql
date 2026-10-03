-- A rejected application: when, and the admin's reason. The owner fixes it and applies again.
-- A live shop an admin turned off keeps both NULL.
ALTER TABLE businesses ADD COLUMN rejected_at INTEGER;
ALTER TABLE businesses ADD COLUMN review_note TEXT;
