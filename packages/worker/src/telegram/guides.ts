import { Language } from "@zumda/core"

import { isRecipientProblem } from "../alerts.js"

import {
    appButton,
    appKeyboard,
    businessAppUrl,
    courierAppUrl,
    linkButton,
    shopAppUrl,
    zumdaShopUrl,
} from "./app-links.js"
import { TelegramApiError, escapeHtml } from "./gateway.js"
import { fill, textsFor } from "./texts.js"
import { welcomeVideo } from "./welcome.js"

import type { Bindings } from "../env.js"
import type { MessageOptions, TelegramGateway, VideoLink } from "./gateway.js"
import type { D1BusinessRepository } from "../repositories/business.repository.js"
import type { GuideAudience, GuideOutcome, GuideRecipient, GuideSender } from "@zumda/core"

interface GuideMessage {
    token: string
    video: VideoLink
    html: string
    options: MessageOptions
}

export interface GuideSenderDeps {
    env: Bindings
    telegram: TelegramGateway
    businesses: D1BusinessRepository
}

/**
 * «Qo'llanma»: each role's guide video from its role's bot. Owners from Zumda | Business,
 * couriers from Zumda | Kuryer, a customer from their shop's own bot with the way to
 * Zumda | Shop (owner's decision, October 2026: the one Zumda video a shop's bot sends).
 */
export class TelegramGuideSender implements GuideSender {
    private shopBotUsername: string | null = null

    constructor(private readonly deps: GuideSenderDeps) {}

    async send(audience: GuideAudience, recipient: GuideRecipient): Promise<GuideOutcome> {
        const message = await this.messageFor(audience, recipient)
        if (!message) {
            return "unreachable"
        }
        try {
            await this.deliver(recipient.telegramId, message)
            return "sent"
        } catch (error) {
            // Blocked, never opened, or a shop's bot no longer connected: nobody to write to.
            if (isRecipientProblem(error) || isUnauthorized(error)) {
                return "unreachable"
            }
            throw error
        }
    }

    /** The video, or the same text alone when Telegram cannot take the video. */
    private async deliver(chatId: number, message: GuideMessage): Promise<void> {
        const { telegram } = this.deps
        try {
            await telegram.sendVideo(
                message.token,
                chatId,
                message.video,
                message.html,
                message.options,
            )
        } catch (error) {
            if (!isBadRequest(error)) {
                throw error
            }
            console.warn(`Guide video failed, sending the text: ${String(error)}`)
            await telegram.sendMessage(message.token, chatId, message.html, message.options)
        }
    }

    private async messageFor(
        audience: GuideAudience,
        recipient: GuideRecipient,
    ): Promise<GuideMessage | null> {
        const { env } = this.deps
        const texts = textsFor(Language.UZ)
        if (audience === "owner") {
            return {
                token: env.BUSINESS_BOT_TOKEN,
                video: welcomeVideo(env.APP_ORIGIN, "business"),
                html: texts.guideOwner,
                options: {
                    keyboard: appKeyboard(
                        texts.openBusinesses,
                        businessAppUrl(env.BUSINESS_APP_ORIGIN),
                    ),
                },
            }
        }
        if (audience === "courier") {
            return {
                token: env.COURIER_BOT_TOKEN,
                video: welcomeVideo(env.APP_ORIGIN, "courier"),
                html: texts.guideCourier,
                options: {
                    keyboard: appKeyboard(
                        texts.myDeliveries,
                        courierAppUrl(env.COURIER_APP_ORIGIN),
                    ),
                },
            }
        }
        return this.customerMessage(recipient)
    }

    private async customerMessage(recipient: GuideRecipient): Promise<GuideMessage | null> {
        const { env, businesses } = this.deps
        const shop = recipient.businessId ? await businesses.findById(recipient.businessId) : null
        const credentials = shop ? await businesses.getBotCredentials(shop.id) : null
        if (!shop || !credentials) {
            return null
        }
        const texts = textsFor(Language.UZ, shop.type)
        const slug = shop.slug.value
        const showcase = zumdaShopUrl(await this.shopBot(), shop.isInShowcase() ? slug : undefined)
        return {
            token: credentials.token,
            video: welcomeVideo(env.APP_ORIGIN, "platform"),
            html: fill(texts.guideCustomer, { shop: `<b>${escapeHtml(shop.name)}</b>` }),
            options: {
                keyboard: {
                    inline_keyboard: [
                        [linkButton(texts.openZumdaShop, showcase)],
                        [appButton(texts.openMenu, shopAppUrl(env.APP_ORIGIN, slug))],
                    ],
                },
            },
        }
    }

    /** Zumda | Shop's username, asked once: the stand's and production's bots differ. */
    private async shopBot(): Promise<string> {
        this.shopBotUsername ??= (
            await this.deps.telegram.getMe(this.deps.env.PLATFORM_BOT_TOKEN)
        ).username
        return this.shopBotUsername
    }
}

/** Telegram could not take what we sent (the video by URL): the text alone still teaches. */
function isBadRequest(error: unknown): boolean {
    return error instanceof TelegramApiError && error.description.startsWith("Bad Request")
}

/** A shop's bot whose token no longer works: its customers cannot be reached through it. */
function isUnauthorized(error: unknown): boolean {
    return error instanceof TelegramApiError && error.description.startsWith("Unauthorized")
}
