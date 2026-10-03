import { DomainError, Phone, TRUSTED_SCOPE, languageFromTelegram } from "@zumda/core"

import { notifyNetworkClaim } from "../network-flow.js"
import { parseCourierInvite, parseNetworkCallback, parseOrderCallback } from "../telegram/format.js"
import { escapeHtml } from "../telegram/gateway.js"
import { Notifier, courierAppUrl } from "../telegram/notifier.js"
import { fill, textsFor } from "../telegram/texts.js"
import { callbackErrorText, isStart, openButton, toTelegramUser } from "../telegram/updates.js"
import { sendWelcome, welcomePictureUrl } from "../telegram/welcome.js"

import type { Services } from "../services.js"
import type { NetworkCallback } from "../telegram/format.js"
import type { BotTexts } from "../telegram/texts.js"
import type { Callback, IncomingMessage } from "../telegram/updates.js"
import type { Language } from "@zumda/core"

/** The courier's language: the one they chose in the app, else Telegram's. */
async function languageOf(
    services: Services,
    telegramId: number,
    fallback?: string,
): Promise<Language> {
    const customer = await services.customers.findByTelegramId(telegramId)
    return customer?.language ?? languageFromTelegram(fallback)
}

/** `/start c_<code>`: the person asks to become a courier of the shop that made the invite. */
async function acceptInvite(
    services: Services,
    message: IncomingMessage,
    code: string,
    t: BotTexts,
): Promise<void> {
    const token = services.env.COURIER_BOT_TOKEN
    const from = message.from
    if (!from) {
        return
    }
    try {
        const user = toTelegramUser(from)
        const joined = await services.useCases.joinAsCourier.execute({ code, user })
        // Order cards follow the person's language: remember it now (Telegram signed this update).
        await services.useCases.resolveCustomer.execute(user, TRUSTED_SCOPE)
        const shop = `<b>${escapeHtml(joined.business.name)}</b>`
        const waiting = fill(t.courierPending, { shop })
        if (joined.needsPhone) {
            await services.telegram.sendMessage(
                token,
                message.chat.id,
                `${waiting}\n\n${t.courierAskPhone}`,
                { askContact: t.sharePhone },
            )
        } else {
            await services.telegram.sendMessage(token, message.chat.id, waiting)
        }
        if (joined.courier.isActive) {
            // Opened another invite of a shop they already deliver for: nothing to approve.
            return
        }
        await new Notifier(services).courierJoined(joined.business, joined.courier)
    } catch (error) {
        if (!(error instanceof DomainError)) {
            throw error
        }
        await services.telegram.sendMessage(token, message.chat.id, t.inviteInvalid)
    }
}

/** The courier's own contact: shops call this number. A forwarded contact never counts. */
async function savePhone(services: Services, message: IncomingMessage, t: BotTexts): Promise<void> {
    const { from, contact } = message
    if (!from || !contact || contact.user_id !== from.id) {
        return
    }
    const profile = await services.couriers.findProfile(from.id)
    if (!profile) {
        return
    }
    profile.setPhone(Phone.create(contact.phone_number), services.clock.now())
    await services.couriers.saveProfile(profile)
    await services.telegram.sendMessage(
        services.env.COURIER_BOT_TOKEN,
        message.chat.id,
        t.phoneSaved,
        { removeKeyboard: true },
    )
}

/** Plain `/start`: the shops they deliver for and the button to the courier screen. */
async function greet(services: Services, message: IncomingMessage, t: BotTexts): Promise<void> {
    const origin = services.env.APP_ORIGIN
    const welcome = {
        token: services.env.COURIER_BOT_TOKEN,
        chatId: message.chat.id,
        pictureUrl: welcomePictureUrl(origin, "courier"),
    }
    const links = message.from ? await services.couriers.listByPerson(message.from.id) : []
    const active = links.filter((link) => link.isActive)
    if (active.length === 0) {
        const pending = links.find((link) => link.isPending)
        const shop = pending ? await services.businesses.findById(pending.businessId) : null
        const html = shop
            ? fill(t.courierPending, { shop: `<b>${escapeHtml(shop.name)}</b>` })
            : t.courierBotWelcome
        await sendWelcome(services.telegram, { ...welcome, html })
        return
    }
    const shops = await Promise.all(active.map((l) => services.businesses.findById(l.businessId)))
    const names = shops.flatMap((shop) => (shop ? [`<b>${escapeHtml(shop.name)}</b>`] : []))
    await sendWelcome(services.telegram, {
        ...welcome,
        html: fill(t.courierBotHome, { shops: names.join(", ") }),
        options: {
            keyboard: openButton(t.myDeliveries, courierAppUrl(services.env.COURIER_APP_ORIGIN)),
        },
    })
}

export async function handleCourierBotMessage(
    services: Services,
    message: IncomingMessage,
): Promise<void> {
    const from = message.from
    if (!from) {
        return
    }
    const t = textsFor(await languageOf(services, from.id, from.language_code))
    if (message.contact) {
        await savePhone(services, message, t)
        return
    }
    const code = parseCourierInvite(message.text)
    if (code) {
        await acceptInvite(services, message, code, t)
        return
    }
    if (isStart(message.text)) {
        await greet(services, message, t)
    }
}

/** "Забрал" / "Доставил × how paid" on an order card: the order's own shop decides. */
export async function handleCourierBotCallback(
    services: Services,
    callback: Callback,
): Promise<void> {
    const token = services.env.COURIER_BOT_TOKEN
    const t = textsFor(await languageOf(services, callback.from.id, callback.from.language_code))
    const network = parseNetworkCallback(callback.data ?? "")
    if (network) {
        await handleNetworkCallback(services, callback, network, t)
        return
    }
    const action = parseOrderCallback(callback.data ?? "")
    if (action?.kind !== "advance") {
        await services.telegram.answerCallback(token, callback.id)
        return
    }
    try {
        const order = await services.useCases.courierAdvanceOrder.execute({
            telegramId: callback.from.id,
            orderId: action.orderId,
            to: action.to,
        })
        const business = await services.businesses.findById(order.businessId)
        if (business) {
            // Notify first: if answering the button fails, the cards and the customer still update.
            await new Notifier(services).orderChanged(business, order)
        }
        await services.telegram.answerCallback(token, callback.id, t.callbackDone)
    } catch (error) {
        await services.telegram.answerCallback(token, callback.id, callbackErrorText(error, t))
    }
}

/** «Беру» on a network offer, or the answer to the one-time network invite. */
async function handleNetworkCallback(
    services: Services,
    callback: Callback,
    action: NetworkCallback,
    t: BotTexts,
): Promise<void> {
    const token = services.env.COURIER_BOT_TOKEN
    const telegramId = callback.from.id
    try {
        if (action.kind === "claim") {
            const claim = await services.useCases.claimNetworkOrder.execute({
                telegramId,
                orderId: action.orderId,
            })
            await notifyNetworkClaim(services, claim)
            await services.telegram.answerCallback(token, callback.id, t.callbackDone)
            return
        }
        const inNetwork = action.kind === "join"
        const profile = await services.useCases.setNetworkMembership.execute({
            telegramId,
            inNetwork,
        })
        if (callback.message) {
            await services.telegram.editMessage(
                token,
                callback.message.chat.id,
                callback.message.message_id,
                inNetwork ? t.networkJoined : t.networkSkipped,
                {
                    keyboard: openButton(
                        t.myDeliveries,
                        courierAppUrl(services.env.COURIER_APP_ORIGIN),
                    ),
                },
            )
        }
        if (profile.inNetwork && profile.onShift) {
            await new Notifier(services).offerWaitingOrders(telegramId)
        }
        await services.telegram.answerCallback(token, callback.id)
    } catch (error) {
        await services.telegram.answerCallback(token, callback.id, callbackErrorText(error, t))
    }
}
