-- «Raqam so'rash» (owner's decision, October 2026): when a platform admin last asked someone
-- without a phone to send it with one button (owners from Zumda | Business, couriers from
-- Zumda | Kuryer). Someone asked waits a day for the next ask. `status`: sent, or unreachable.
-- Additive: the previous Worker never reads it.
CREATE TABLE phone_asks (
    audience TEXT NOT NULL,
    telegram_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    asked_at INTEGER NOT NULL,
    PRIMARY KEY (audience, telegram_id)
);
