-- Shop bots created from the Zumda bot (Telegram Managed Bots): the owner never sees the token.
-- Additive only: the old Worker keeps working on this schema.

-- How the shop's bot came: 'managed' (created from the Zumda bot) or 'token' (pasted).
ALTER TABLE businesses ADD COLUMN bot_source TEXT NOT NULL DEFAULT 'token';

-- Bots an owner created from the Zumda bot. A row exists before the shop does (the owner then
-- applies with it) and keeps the bot's current token; business_id is set once a shop takes it.
CREATE TABLE managed_bots (
    bot_id INTEGER PRIMARY KEY,
    bot_username TEXT NOT NULL,
    owner_telegram_id INTEGER NOT NULL,
    token_enc TEXT NOT NULL,
    business_id TEXT REFERENCES businesses (id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_managed_bots_owner ON managed_bots (owner_telegram_id, business_id);
