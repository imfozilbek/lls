-- «O'zbekiston bo'ylab yetkazamiz» (owner's decision, November 2026): a shop that sends by the
-- post or a taxi the customer pays delivers anywhere in the country, so no radius holds; the
-- storefront says «O'zbekiston bo'ylab yetkazib beramiz (pochta, taksi)». Only with
-- customer_pays_carrier = 1.
ALTER TABLE businesses ADD COLUMN delivers_nationwide INTEGER NOT NULL DEFAULT 0;
