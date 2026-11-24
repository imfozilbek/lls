-- The shop's support group: a closed group with topics where a customer's messages to the shop's
-- bot come, one topic a customer, and the shop's people answer from it (owner's decision, November
-- 2026; goal 21). Additive: the previous Worker never reads these tables. No message is stored:
-- the bot copies each one, the talk stays in Telegram.

-- The group where the shop's bot is an admin who may make topics: one per shop, the row only while
-- connected. `chat_id` is Telegram's (negative, `-100…`).
CREATE TABLE support_groups (
    business_id TEXT PRIMARY KEY REFERENCES businesses(id),
    chat_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    connected_at INTEGER NOT NULL
);

-- A customer's own topic in a group. Keyed by the group: a topic of a group connected before
-- means nothing in the next one (its rows stay, never read again).
CREATE TABLE support_threads (
    chat_id INTEGER NOT NULL,
    customer_telegram_id INTEGER NOT NULL,
    business_id TEXT NOT NULL,
    thread_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (chat_id, customer_telegram_id)
) WITHOUT ROWID;

-- An answer in a topic: whose topic it is.
CREATE UNIQUE INDEX idx_support_threads_thread ON support_threads (chat_id, thread_id);
