-- The showcase search: every word of a product's search text, so a search reads only the
-- products that match (a prefix range) instead of every product of every showcase shop. A plain
-- table, not FTS5: `wrangler d1 export` (the weekly backup) cannot export virtual tables.
CREATE TABLE product_words (
    word       TEXT NOT NULL,
    product_id TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    PRIMARY KEY (word, product_id)
) WITHOUT ROWID;

CREATE INDEX idx_product_words_product ON product_words (product_id);

-- The words of the products already there: search_text is " word word ...".
INSERT OR IGNORE INTO product_words (word, product_id)
WITH RECURSIVE split (product_id, rest, word) AS (
    SELECT id, trim(search_text) || ' ', '' FROM products
    UNION ALL
    SELECT product_id, substr(rest, instr(rest, ' ') + 1), substr(rest, 1, instr(rest, ' ') - 1)
    FROM split WHERE rest <> ''
)
SELECT word, product_id FROM split WHERE word <> '';
