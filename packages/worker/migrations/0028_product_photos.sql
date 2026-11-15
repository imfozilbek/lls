-- Up to three photos of a product (owner's decision, November 2026): `image_key` stays the main
-- one (the menu, the showcase, the catalog); `more_images` holds up to two more, a JSON array of
-- R2 keys in their order (NULL: none). Additive: the previous Worker names its columns and never
-- reads this one.
ALTER TABLE products ADD COLUMN more_images TEXT;
