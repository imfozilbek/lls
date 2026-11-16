-- The customer's one live message per order (owner's decision, November 2026): its Telegram id,
-- so the next important step replaces it. And which bot holds the owner's card: 'shop' (the shop's
-- own, also NULL), or 'business' while the shop's bot may not write to the owner, so the card is
-- edited there instead of sent again. Additive: the Worker before it never reads them.
ALTER TABLE orders ADD COLUMN customer_message_id INTEGER;
ALTER TABLE orders ADD COLUMN owner_message_via TEXT;
