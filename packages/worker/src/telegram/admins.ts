/**
 * Messages to the platform admins come from Zumda | Platforma, their own bot (owner's decision,
 * October 2026): applications, alerts, late network orders, a bot that did not connect.
 *
 * Telegram lets a bot write first only to someone who pressed Start in it. An admin who has not
 * yet done so in Zumda | Platforma gets the same message from Zumda | Business instead, with the
 * note to press Start there and a link to it: no application or alert is lost on the way. In that
 * copy the app buttons become the link (initData of Zumda | Business does not open «Platforma»);
 * «Tasdiqlash / Rad etish» stay, Zumda | Business answers them too.
 */
import { Language } from "@zumda/core"

import { isRecipientProblem, toEach } from "../alerts.js"
import { platformAdminIds } from "../env.js"

import { linkButton } from "./app-links.js"
import { escapeHtml } from "./gateway.js"
import { fill, textsFor } from "./texts.js"

import type { Services } from "../services.js"
import type { InlineButton, InlineKeyboard } from "./gateway.js"
import type { BotTexts } from "./texts.js"

export interface AdminMessage {
    /** HTML. */
    text: string
    keyboard?: InlineKeyboard
}

async function textsOf(services: Services, adminId: number): Promise<BotTexts> {
    const customer = await services.customers.findByTelegramId(adminId)
    return textsFor(customer?.language ?? Language.UZ)
}

/** The card's action buttons, and in place of its app buttons the link to Zumda | Platforma. */
function viaBusinessKeyboard(
    keyboard: InlineKeyboard | undefined,
    link: InlineButton,
): InlineKeyboard {
    const rows = (keyboard?.inline_keyboard ?? [])
        .map((row) => row.filter((button) => button.web_app === undefined))
        .filter((row) => row.length > 0)
    return { inline_keyboard: [...rows, [link]] }
}

/** One admin: Zumda | Platforma, or Zumda | Business with the note when it cannot write yet. */
export async function toAdmin(
    services: Services,
    adminId: number,
    message: (texts: BotTexts) => AdminMessage,
): Promise<void> {
    const texts = await textsOf(services, adminId)
    const { text, keyboard } = message(texts)
    try {
        await services.telegram.sendMessage(services.env.ADMIN_BOT_TOKEN, adminId, text, {
            keyboard,
        })
    } catch (error) {
        if (!isRecipientProblem(error)) {
            throw error
        }
        const bot = `@${(await services.telegram.getMe(services.env.ADMIN_BOT_TOKEN)).username}`
        const link = linkButton(fill(texts.openAdminBot, { bot }), `https://t.me/${bot.slice(1)}`)
        await services.telegram.sendMessage(
            services.env.BUSINESS_BOT_TOKEN,
            adminId,
            `${fill(texts.adminBotClosed, { bot: escapeHtml(bot) })}\n\n${text}`,
            { keyboard: viaBusinessKeyboard(keyboard, link) },
        )
    }
}

/**
 * Every platform admin, each on their own: one the bots cannot reach at all is skipped, and the
 * admins after them still get theirs.
 */
export async function toAdmins(
    services: Services,
    message: (texts: BotTexts) => AdminMessage,
): Promise<void> {
    await toEach(platformAdminIds(services.env), (adminId) => toAdmin(services, adminId, message))
}
