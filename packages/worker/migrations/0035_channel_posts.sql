-- Every post of the shop's channel in Zumda (owner's decision, November 2026): the posts the
-- owner makes in Telegram too, and the channel's past read from its public page. Additive: the
-- previous Worker writes 'zumda' posts and ad links as before (the defaults).

-- Who made the post: 'zumda' («Kanalga joylash»: its caption is Zumda's to keep true) or
-- 'channel' (the owner in Telegram: the text is theirs, only the button is Zumda's).
ALTER TABLE source_links ADD COLUMN origin TEXT NOT NULL DEFAULT 'zumda'
    CHECK (origin IN ('zumda', 'channel'));
-- A post made in Telegram: its first words, and when «Buyurtma berish» was put under it.
ALTER TABLE source_links ADD COLUMN preview TEXT;
ALTER TABLE source_links ADD COLUMN button_at INTEGER;

-- One row a post: a post Telegram brings twice, or the channel's page shows again, is written
-- once (and Zumda's posts already in a channel are known by it).
CREATE UNIQUE INDEX idx_source_links_post ON source_links (chat_id, message_id)
    WHERE message_id IS NOT NULL;

-- The set of updates the shop's bot was registered for since the channel was connected (0: not
-- yet the channel's own posts); the past read so far (the next page is before this message); and
-- when it was read to the first post.
ALTER TABLE shop_channels ADD COLUMN updates_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shop_channels ADD COLUMN history_before INTEGER;
ALTER TABLE shop_channels ADD COLUMN history_done_at INTEGER;
