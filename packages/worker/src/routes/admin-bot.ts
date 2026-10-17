/**
 * The Zumda | Platforma bot (webhook `/tg/admin`): the platform admins' own bot. It only
 * notifies: applications with «Tasdiqlash / Rad etish», alerts, late network orders; the work is
 * done in «Platforma» (owner's decision: bots notify, the Mini App acts). Someone who is not an
 * admin is pointed to Zumda's bots for customers and businesses.
 */
import { languageFromTelegram } from "@zumda/core"

import { platformAdminIds } from "../env.js"
import {
    appKeyboard,
    linkButton,
    platformAppUrl,
    zumdaBusinessUrl,
    zumdaShopUrl,
} from "../telegram/app-links.js"
import { textsFor } from "../telegram/texts.js"
import { isStart } from "../telegram/updates.js"

import type { Services } from "../services.js"
import type { InlineKeyboard } from "../telegram/gateway.js"
import type { BotTexts } from "../telegram/texts.js"
import type { IncomingMessage } from "../telegram/updates.js"

/** Zumda | Shop and Zumda | Business, for a stranger who found the admins' bot. */
async function zumdaBotsKeyboard(services: Services, texts: BotTexts): Promise<InlineKeyboard> {
    const [shop, business] = await Promise.all([
        services.telegram.getMe(services.env.PLATFORM_BOT_TOKEN),
        services.telegram.getMe(services.env.BUSINESS_BOT_TOKEN),
    ])
    return {
        inline_keyboard: [
            [linkButton(texts.openZumdaShop, zumdaShopUrl(shop.username))],
            [linkButton(texts.openZumdaBusiness, zumdaBusinessUrl(business.username))],
        ],
    }
}

/** `/start` gets the greeting, anything else one line; both with the button to «Platforma». */
export async function handleAdminMessage(
    services: Services,
    message: IncomingMessage,
): Promise<void> {
    const from = message.from
    if (!from) {
        return
    }
    const texts = textsFor(languageFromTelegram(from.language_code))
    const token = services.env.ADMIN_BOT_TOKEN
    if (!platformAdminIds(services.env).includes(from.id)) {
        await services.telegram.sendMessage(token, message.chat.id, texts.adminBotOnlyTeam, {
            keyboard: await zumdaBotsKeyboard(services, texts),
        })
        return
    }
    const keyboard = appKeyboard(texts.openPlatform, platformAppUrl(services.env.ADMIN_APP_ORIGIN))
    const text = isStart(message.text) ? texts.adminWelcome : texts.onlyInApp
    await services.telegram.sendMessage(token, message.chat.id, text, { keyboard })
}
