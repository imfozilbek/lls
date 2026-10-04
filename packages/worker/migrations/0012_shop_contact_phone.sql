-- The number customers call about an order (a transfer the owner did not see). Optional, E.164.
-- Additive: the previous Worker never reads it.
ALTER TABLE businesses ADD COLUMN contact_phone TEXT;
