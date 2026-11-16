-- The delivery price is the owner's choice (owner's decision, November 2026): «Bepul», «Narxi
-- bor» or «Narxi keyin aytiladi». A shop that never chose has a fee of 0 only because nobody said
-- otherwise: customers are told nothing about delivery, never «bepul», until the owner chooses in
-- «Ishga tayyor». Additive: the previous Worker names its columns and never reads these.
ALTER TABLE businesses ADD COLUMN delivery_price_set INTEGER NOT NULL DEFAULT 0;
-- A shop that asks a fee, or lets the customer pay the carrier, has chosen already.
UPDATE businesses SET delivery_price_set = 1 WHERE delivery_fee > 0 OR customer_pays_carrier = 1;
-- The order promised free delivery (the shop's «Bepul», or its «… dan bepul» reached): only then
-- does it say «bepul». Older orders say nothing about a fee of 0.
ALTER TABLE orders ADD COLUMN delivery_free INTEGER NOT NULL DEFAULT 0;
