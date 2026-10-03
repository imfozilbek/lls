/**
 * How a shop's bot came to Zumda:
 * - `managed`: the owner created it from the Zumda bot (Telegram Managed Bots); Zumda fetched its
 *   token itself and the owner never saw it;
 * - `token`: the owner made it in @BotFather and pasted its token (bots made before).
 */
export enum BotSource {
    MANAGED = "managed",
    TOKEN = "token",
}

export const BOT_SOURCES: readonly BotSource[] = Object.values(BotSource)
