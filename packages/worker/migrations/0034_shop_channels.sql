-- The shop's own Telegram channel, and where customers came from (owner's decision, November
-- 2026). Additive: the previous Worker never reads these tables or the new column.

-- The channel where the shop's bot is an admin who may post: one per shop, the row only while
-- connected. `chat_id` is Telegram's (negative, `-100…`).
CREATE TABLE shop_channels (
    business_id TEXT PRIMARY KEY REFERENCES businesses(id),
    chat_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    username TEXT,
    connected_at INTEGER NOT NULL
);

-- A post of a product in the shop's channel, or a named link for an ad in another channel: both
-- are `t.me/<shop bot>?start=s_<id>`. `product_id` has no foreign key: deleting a product must
-- not fail because it was once posted. The counters are never indexed (an increment writes one
-- row): opens (each person once), orders (placed), sales and revenue (delivered, goods only).
CREATE TABLE source_links (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id),
    kind TEXT NOT NULL CHECK (kind IN ('post', 'ad')),
    product_id TEXT,
    label TEXT,
    chat_id INTEGER,
    message_id INTEGER,
    photo_file_id TEXT,
    owner_text TEXT,
    post_key TEXT,
    opens INTEGER NOT NULL DEFAULT 0,
    orders INTEGER NOT NULL DEFAULT 0,
    sales INTEGER NOT NULL DEFAULT 0,
    revenue INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    deleted_at INTEGER
);

-- «Telegram kanal» and «Reklama havolalari»: the live links of one kind, newest first.
CREATE INDEX idx_source_links_live ON source_links (business_id, kind, created_at DESC)
    WHERE deleted_at IS NULL;

-- A product's name or price changed: its newest live posts.
CREATE INDEX idx_source_links_product_posts
    ON source_links (business_id, product_id, created_at DESC)
    WHERE kind = 'post' AND deleted_at IS NULL;

-- The link each person pressed last in a shop: their next order within 7 days counts for it.
CREATE TABLE source_visits (
    business_id TEXT NOT NULL,
    telegram_id INTEGER NOT NULL,
    link_id TEXT NOT NULL,
    at INTEGER NOT NULL,
    PRIMARY KEY (business_id, telegram_id)
) WITHOUT ROWID;

-- The link an order came from: a snapshot, never changed.
ALTER TABLE orders ADD COLUMN source_link_id TEXT;
