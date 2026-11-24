-- The support group made easy to work in (owner's decisions, November 2026; goal 22). Additive:
-- the previous Worker never reads these columns or the new table.

-- A customer's topic: waiting for the shop's answer since (its ❓; NULL: answered, its ✅), its
-- pinned card, and the name it has now («Ism · telefon», renamed only when it would change).
ALTER TABLE support_threads ADD COLUMN waiting_since INTEGER;
ALTER TABLE support_threads ADD COLUMN card_message_id INTEGER;
ALTER TABLE support_threads ADD COLUMN topic_name TEXT;

-- Why the shop's group was not connected, or was lost, the last time: the app says it. One a
-- shop, cleared when a group is connected.
CREATE TABLE support_refusals (
    business_id TEXT PRIMARY KEY REFERENCES businesses(id),
    reason TEXT NOT NULL CHECK (reason IN ('notOwner', 'demo', 'notForum', 'noTopics', 'lost')),
    title TEXT NOT NULL,
    at INTEGER NOT NULL
);
