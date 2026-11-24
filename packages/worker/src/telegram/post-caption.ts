import { Language, Unit } from "@zumda/core"

import { sourceStartUrl, supportStartUrl } from "./app-links.js"
import { formatMoney } from "./format.js"
import { escapeHtml } from "./gateway.js"
import { fill } from "./texts.js"

import type { InlineKeyboard } from "./gateway.js"
import type { BotTexts } from "./texts.js"
import type { PostFacts } from "@zumda/core"

/** «35 000 so'm / kg», «18 000 so'm dan»: what one unit costs. */
export function priceLine(facts: PostFacts, t: BotTexts): string {
    const money = formatMoney(facts.price, Language.UZ)
    const word = facts.unit === Unit.G100 ? `100 ${t.g}` : t.units[facts.unit]
    const perUnit = word && facts.unit !== Unit.PORTION ? ` / ${word}` : ""
    const price = `<b>${money}</b>${perUnit}`
    return `💰 ${facts.priceFrom ? fill(t.priceFrom, { price }) : price}`
}

/**
 * A product's post in the shop's channel: the name (bold), the owner's own words as they wrote
 * them, then the price and the age, which Zumda keeps true. No delivery line: a post lives long
 * and the shop's delivery price may change.
 */
export function postCaption(facts: PostFacts, ownerText: string | undefined, t: BotTexts): string {
    const lines = [`<b>${escapeHtml(facts.name)}</b>`]
    if (ownerText) {
        lines.push("", escapeHtml(ownerText))
    }
    lines.push("", priceLine(facts, t))
    if (facts.ageFrom !== undefined) {
        lines.push(fill(t.ageFrom, { age: String(facts.ageFrom) }))
    }
    return lines.join("\n")
}

/**
 * «🛒 Buyurtma berish» under a post: the shop's bot, told which post was pressed. A shop that
 * answers questions in its support group (goal 23) adds «💬 Savolim bor» below it.
 */
export function postKeyboard(
    botUsername: string,
    linkId: string,
    t: BotTexts,
    asks = false,
): InlineKeyboard {
    const order = [
        {
            text: t.orderButton,
            url: sourceStartUrl(botUsername, linkId),
            style: "success" as const,
        },
    ]
    const question = [{ text: t.supportButton, url: supportStartUrl(botUsername, linkId) }]
    return { inline_keyboard: asks ? [order, question] : [order] }
}

/** The card the shop's bot sends for a pressed link: the name, the price, sold out or not. */
export function productCardCaption(facts: PostFacts, soldOut: boolean, t: BotTexts): string {
    const lines = [`<b>${escapeHtml(facts.name)}</b>`, priceLine(facts, t)]
    if (soldOut) {
        lines.push(t.soldOutNow)
    }
    return lines.join("\n")
}
