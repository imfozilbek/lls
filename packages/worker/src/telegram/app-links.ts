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

/** A showcase customer's order, opened from Zumda | Shop: the shop inside the showcase. */
export function showcaseOrderUrl(appOrigin: string, slug: string, orderId: string): string {
    return `${showcaseAppUrl(appOrigin)}&shop=${encodeURIComponent(slug)}&order=${encodeURIComponent(orderId)}`
}

/** The courier's screen across all their shops, opened from Zumda | Kuryer. */
export function courierAppUrl(appOrigin: string): string {
    return `${appOrigin}/?mode=courier`
}

/** «Mening bizneslarim»: the owner's businesses, opened from Zumda | Business. */
export function businessAppUrl(appOrigin: string): string {
    return `${appOrigin}/?mode=business`
}

/** What «Platforma» opens on: the applications, one shop, or the districts. */
export type PlatformTarget = "applications" | "districts" | { shopId: string }

/** «Platforma», the admins' section of Zumda | Business. */
export function platformAppUrl(appOrigin: string, target: PlatformTarget): string {
    const value = typeof target === "string" ? target : `shop_${target.shopId}`
    return `${businessAppUrl(appOrigin)}&admin=${encodeURIComponent(value)}`
}

/** The Zumda showcase: search across shops, opened from Zumda | Shop. */
export function showcaseAppUrl(appOrigin: string): string {
    return `${appOrigin}/?mode=market`
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
