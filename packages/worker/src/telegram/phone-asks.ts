import { BusinessStatus, Language } from "@zumda/core"

import { isRecipientProblem } from "../alerts.js"

import { escapeHtml } from "./gateway.js"
import { fill, textsFor } from "./texts.js"

import type { Bindings } from "../env.js"
import type { TelegramGateway } from "./gateway.js"
import type { D1BusinessRepository } from "../repositories/business.repository.js"
import type { GuideOutcome, PhoneAskRecipient, PhoneAskSender } from "@zumda/core"

export interface PhoneAskSenderDeps {
    env: Bindings
    telegram: TelegramGateway
    businesses: D1BusinessRepository
}

/**
 * «Raqam so'rash»: the ask with one button from the person's role's bot. An owner gets it from
 * Zumda | Business with «📱 Raqamimni yuborish» (their Telegram number becomes the shop's) and
 * «✏️ Boshqa raqam yozaman»; a courier from Zumda | Kuryer with «📱 Raqamni yuborish».
 */
export class TelegramPhoneAskSender implements PhoneAskSender {
    constructor(private readonly deps: PhoneAskSenderDeps) {}

    async ask(recipient: PhoneAskRecipient): Promise<GuideOutcome> {
        const { env, telegram } = this.deps
        const texts = textsFor(Language.UZ)
        try {
            if (recipient.audience === "owner") {
                await telegram.sendMessage(
                    env.BUSINESS_BOT_TOKEN,
                    recipient.telegramId,
                    fill(texts.ownerPhoneAsk, { shops: await this.shopsOf(recipient) }),
                    { askContact: texts.ownerPhoneShare, askContactOr: texts.ownerPhoneOther },
                )
            } else {
                await telegram.sendMessage(
                    env.COURIER_BOT_TOKEN,
                    recipient.telegramId,
                    texts.courierPhoneFirst,
                    { askContact: texts.sharePhone },
                )
            }
            return "sent"
        } catch (error) {
            // Blocked, or never opened the bot: nobody to write to today.
            if (isRecipientProblem(error)) {
                return "unreachable"
            }
            throw error
        }
    }

    /** The owner's live shops that take no orders for want of a number, by name. */
    private async shopsOf(recipient: PhoneAskRecipient): Promise<string> {
        const shops = await this.deps.businesses.listByOwner(recipient.telegramId)
        const names = shops
            .filter(
                (shop) =>
                    shop.status === BusinessStatus.ACTIVE &&
                    !shop.isDemo() &&
                    shop.contactPhone === undefined,
            )
            .map((shop) => `<b>${escapeHtml(shop.name)}</b>`)
        return names.length > 0 ? names.join(", ") : textsFor(Language.UZ).yourShop
    }
}
