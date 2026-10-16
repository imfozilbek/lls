/**
 * Where every bot sends people: the Mini App. A bot only notifies; the work is done in the app
 * (owner's decision). These are the app's addresses, and the button that opens them.
 */
import type { InlineButton, InlineKeyboard } from "./gateway.js"

/** The shop's storefront (customer) or owner section (owner), opened from the shop's bot. */
export function shopAppUrl(appOrigin: string, slug: string, orderId?: string): string {
    const order = orderId ? `&order=${encodeURIComponent(orderId)}` : ""
    return `${appOrigin}/?shop=${encodeURIComponent(slug)}${order}`
}

/**
 * The shop's bot opened on Start (`/start owner`): the owner presses it once, then the bot may
 * write to them (orders, files).
 */
export function shopBotStartUrl(botUsername: string): string {
    return `https://t.me/${botUsername}?start=${OWNER_START}`
}

/** The `/start` payload of `shopBotStartUrl`. */
export const OWNER_START = "owner"

/** A showcase customer's order, opened from Zumda | Shop: the shop inside the showcase. */
export function showcaseOrderUrl(appOrigin: string, slug: string, orderId: string): string {
    return `${showcaseAppUrl(appOrigin)}&shop=${encodeURIComponent(slug)}&order=${encodeURIComponent(orderId)}`
}

/**
 * The courier's screen across all their shops, opened from Zumda | Kuryer; with `orderId`, on
 * that order's card.
 */
export function courierAppUrl(appOrigin: string, orderId?: string): string {
    const order = orderId ? `&order=${encodeURIComponent(orderId)}` : ""
    return `${appOrigin}/?mode=courier${order}`
}

/**
 * «Mening bizneslarim»: the owner's businesses, opened from Zumda | Business; with `shop`, right
 * on that business's owner section (and on the order, when the message is about one).
 */
export function businessAppUrl(
    appOrigin: string,
    shop?: { slug: string; orderId?: string },
): string {
    const base = `${appOrigin}/?mode=business`
    if (!shop) {
        return base
    }
    const order = shop.orderId ? `&order=${encodeURIComponent(shop.orderId)}` : ""
    return `${base}&shop=${encodeURIComponent(shop.slug)}${order}`
}

/** What «Platforma» opens on: the applications, one shop, or the districts. */
export type PlatformTarget = "applications" | "districts" | { shopId: string }

/**
 * «Platforma», the platform admins' app, opened from Zumda | Platforma (`adminOrigin`:
 * platform.zumda.shop); with `target`, right on it.
 */
export function platformAppUrl(adminOrigin: string, target?: PlatformTarget): string {
    const base = `${adminOrigin}/?mode=admin`
    if (!target) {
        return base
    }
    const value = typeof target === "string" ? target : `shop_${target.shopId}`
    return `${base}&admin=${encodeURIComponent(value)}`
}

/** Zumda | Business in Telegram: a link from another bot. */
export function zumdaBusinessUrl(botUsername: string): string {
    return `https://t.me/${botUsername}`
}

/** The Zumda showcase: search across shops, opened from Zumda | Shop. */
export function showcaseAppUrl(appOrigin: string): string {
    return `${appOrigin}/?mode=market`
}

/**
 * Zumda | Shop in Telegram; with a shop in the showcase, opened right on it (`m_<slug>`, the
 * same link as the Zumda Shop QR).
 */
export function zumdaShopUrl(botUsername: string, showcaseSlug?: string): string {
    const start = showcaseSlug ? `?startapp=m_${showcaseSlug}` : ""
    return `https://t.me/${botUsername}${start}`
}

/** A button that opens a Telegram link: another bot, not this bot's Mini App. */
export function linkButton(label: string, url: string): InlineButton {
    return { text: label, url }
}

export function appButton(label: string, url: string): InlineButton {
    return { text: label, web_app: { url } }
}

/** The action buttons of a message, and under them the button to the app. */
export function withAppButton(keyboard: InlineKeyboard, button: InlineButton): InlineKeyboard {
    return { inline_keyboard: [...keyboard.inline_keyboard, [button]] }
}

export function appKeyboard(label: string, url: string): InlineKeyboard {
    return { inline_keyboard: [[appButton(label, url)]] }
}
