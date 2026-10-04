/**
 * Whether the shop's own bot can write to its owner. Telegram lets a bot write first only to
 * someone who pressed Start in it, and a bot made with «Bot yaratish» was never opened:
 * - `open`: the owner pressed Start, or the bot's last message to the owner arrived;
 * - `closed`: Telegram refused the bot's last message (never started, or blocked);
 * - `unknown`: nothing tried yet (shops from before this was tracked).
 */
export enum OwnerChat {
    OPEN = "open",
    CLOSED = "closed",
    UNKNOWN = "unknown",
}
