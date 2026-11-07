-- A toy shop sorts its toys the way parents look for them (owner's decision, November 2026).
-- `more_categories`: the categories a product also stands in on the storefront besides its main
-- `category`, a JSON array of up to two ids (NULL: none). `age_from`: the child's age it is for,
-- from this many years (0, 1, 3, 5, 7, 12; NULL: not given). Additive: the previous Worker names
-- its columns and never reads these.
ALTER TABLE products ADD COLUMN more_categories TEXT;
ALTER TABLE products ADD COLUMN age_from INTEGER;
