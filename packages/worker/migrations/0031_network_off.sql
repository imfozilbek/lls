-- «Tuman tarmog'idan foydalanish» (owner's decision, November 2026): one switch for the district
-- network, off until the shop's owner turns it on. Every shop switched off once, as the owner
-- decided for the live ones; an order already waiting for a network courier stays as it is.
-- Data only: the column and the previous Worker stay as they were.
UPDATE businesses SET network_delivery = 0;
