/** A bot the owner created from the Zumda bot, before (and after) it becomes a shop's bot. */
export interface ManagedBotRecord {
    botId: number
    username: string
    /** Who created (owns) the bot in Telegram. */
    ownerTelegramId: number
    /** The shop that took the bot; undefined while it waits for the owner's application. */
    businessId?: string
}

export interface ManagedBotRepository {
    find(botId: number): Promise<ManagedBotRecord | null>
    /** Creates or updates the record with the bot's current token. The adapter encrypts it. */
    record(bot: ManagedBotRecord, token: string): Promise<void>
    /** The bot's current token, for the shop that takes it. */
    token(botId: number): Promise<string | null>
    /** The owner's bots that no shop took yet: the wizard picks the one just created. */
    listUnclaimed(ownerTelegramId: number): Promise<ManagedBotRecord[]>
    claim(botId: number, businessId: string): Promise<void>
}
