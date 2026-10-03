-- A shop keeps many cards for customers' transfers and chooses which one customers are shown.
-- Additive only: the old Worker keeps working on this schema.

-- Every card of the shop. Not a secret: customers are shown the payment card.
CREATE TABLE payout_cards (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses (id),
    number TEXT NOT NULL,
    holder TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (business_id, number)
);
CREATE INDEX idx_payout_cards_business ON payout_cards (business_id, created_at);

-- The payment card. Its number and holder stay in payout_card_number / payout_card_holder too,
-- so the old Worker and every list read it without a join. No foreign key: a new shop and its
-- first card point at each other; the domain never removes the payment card.
ALTER TABLE businesses ADD COLUMN payment_card_id TEXT;

-- The card the customer was shown when placing the order: the money went there.
ALTER TABLE orders ADD COLUMN payment_card_number TEXT;
ALTER TABLE orders ADD COLUMN payment_card_holder TEXT;

-- Today's single card of each shop becomes the first card of its list.
INSERT INTO payout_cards (id, business_id, number, holder, created_at)
SELECT lower(hex(randomblob(16))), id, payout_card_number, payout_card_holder, updated_at
FROM businesses
WHERE payout_card_number IS NOT NULL AND payout_card_holder IS NOT NULL;

UPDATE businesses
SET payment_card_id = (
    SELECT c.id FROM payout_cards c
    WHERE c.business_id = businesses.id AND c.number = businesses.payout_card_number
)
WHERE payout_card_number IS NOT NULL;
