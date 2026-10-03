-- «Do'konga eslatish»: when the customer last asked the owner to look at the transfer again.
-- Additive: the previous Worker never reads it.
ALTER TABLE orders ADD COLUMN transfer_reminded_at INTEGER;
