import type { Services } from "../services.js"

/**
 * Telegram may not send `managed_bot` when the owner changes their bot's token in @BotFather, so
 * the saved token can be old. Before a managed bot is used (an application, an approval,
 * «Botni qayta ulash»), Zumda asks Telegram for the current one and saves it. The owner on record
 * stays: the caller can never move the bot to someone else. A bot Zumda does not manage: nothing
 * to do.
 */
export async function refreshManagedBotToken(services: Services, botId: number): Promise<void> {
    const record = await services.managedBots.find(botId)
    if (!record) {
        return
    }
    const token = await services.telegram.getManagedBotToken(services.env.BUSINESS_BOT_TOKEN, botId)
    await services.useCases.managedBotChanged.execute({
        bot: { id: record.botId, username: record.username },
        ownerTelegramId: record.ownerTelegramId,
        token,
    })
}
