-- Can the shop's own bot write to its owner? Telegram lets a bot write first only to someone who
-- pressed Start in it, and a bot made with «Bot yaratish» was never opened. Whichever is newer
-- wins: the bot reached the owner (or the owner pressed Start), or Telegram refused it.
-- Additive: the previous Worker never reads them.
ALTER TABLE businesses ADD COLUMN owner_chat_open_at INTEGER;
ALTER TABLE businesses ADD COLUMN owner_chat_closed_at INTEGER;
