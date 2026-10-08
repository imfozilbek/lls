-- «Qo'llanma» (owner's decision, October 2026): who has had their role's guide video, sent once
-- by a platform admin from «Platforma». `status`: sent, or unreachable (blocked the bot, never
-- opened it). Additive: the previous Worker never reads it.
CREATE TABLE guide_sends (
    audience TEXT NOT NULL,
    telegram_id INTEGER NOT NULL,
    business_id TEXT,
    status TEXT NOT NULL,
    sent_at INTEGER NOT NULL,
    PRIMARY KEY (audience, telegram_id)
);
