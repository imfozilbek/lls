import { BusinessRuleViolationError } from "@zumda/core"
import { Hono } from "hono"

import { requireOwner, shopOf } from "../auth.js"
import { ApiError } from "../http/errors.js"
import { startGroupUrl } from "../telegram/app-links.js"
import { TelegramApiError } from "../telegram/gateway.js"

import { registerShopWebhook } from "./channel.routes.js"

import type { AppEnv } from "../env.js"
import type { SupportGroup, SupportRefusal } from "@zumda/core"

/** What the owner sees of the support group: its name and since when. */
function toSupportGroupDTO(group: SupportGroup): { title: string; connectedAt: string } {
    return { title: group.title, connectedAt: group.connectedAt.toISOString() }
}

/** Why the last try failed, for the app to say (and since when: newer than the owner's press). */
function toRefusalDTO(refusal: SupportRefusal): { reason: string; title: string; at: string } {
    return { reason: refusal.reason, title: refusal.title, at: refusal.at.toISOString() }
}

/**
 * «Mijozlar savollari» (owner's decision, November 2026; goal 21): the shop's closed group with
 * topics, connected from Telegram's own screen; customers' messages to the shop's bot come there.
 */
export const supportRoutes = new Hono<AppEnv>()
    .use(requireOwner)

    .get("/support", async (c) => {
        const { group, refusal } = await c.get("services").useCases.getSupportGroup.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: shopOf(c).id,
        })
        return c.json({
            group: group ? toSupportGroupDTO(group) : null,
            refusal: refusal ? toRefusalDTO(refusal) : null,
        })
    })

    /**
     * «Guruhni bog'lash»: the shop's bot hears `my_chat_member` and the group's messages from now
     * on (a shop connected long ago gets them here), then the app opens Telegram's own screen.
     */
    .post("/support/connect", async (c) => {
        const services = c.get("services")
        const business = shopOf(c)
        if (business.isDemo()) {
            throw BusinessRuleViolationError.demoNotPromoted(business.id)
        }
        const credentials = await services.businesses.getBotCredentials(business.id)
        if (!credentials) {
            throw new ApiError(502, "SUPPORT_SETUP_FAILED", "The shop's bot is not connected")
        }
        try {
            await registerShopWebhook(c, credentials)
        } catch (error) {
            if (error instanceof TelegramApiError) {
                throw new ApiError(502, "SUPPORT_SETUP_FAILED", "Telegram did not answer")
            }
            throw error
        }
        return c.json({ url: startGroupUrl(business.bot.username) })
    })

    /** «Guruhni ajratish»: Zumda forgets it first, then the bot leaves (its echo changes nothing). */
    .delete("/support", async (c) => {
        const services = c.get("services")
        const business = shopOf(c)
        const removed = await services.useCases.disconnectSupportGroup.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: business.id,
        })
        const credentials = removed
            ? await services.businesses.getBotCredentials(business.id)
            : null
        if (removed && credentials) {
            await services.telegram.leaveChat(credentials.token, removed.chatId).catch(() => {
                // The group is forgotten either way; the owner may remove the bot by hand.
            })
        }
        return c.body(null, 204)
    })
