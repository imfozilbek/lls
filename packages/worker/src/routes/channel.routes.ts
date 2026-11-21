import { zValidator } from "@hono/zod-validator"
import { BusinessRuleViolationError, normalizePage, toShopChannelDTO } from "@zumda/core"
import { Hono } from "hono"

import { requireOwner, shopOf } from "../auth.js"
import { ApiError } from "../http/errors.js"
import { readJpeg } from "../http/images.js"
import { rateLimit } from "../http/rate-limit.js"
import {
    adLinkBody,
    channelPostQuery,
    idParam,
    onInvalid,
    sourceLinksQuery,
} from "../http/schemas.js"
import { sourceStartUrl, startChannelUrl } from "../telegram/app-links.js"
import { deleteSourceLinkUseCase, publishPostUseCase } from "../telegram/channel-publisher.js"
import { TelegramApiError } from "../telegram/gateway.js"

import type { AppEnv } from "../env.js"
import type { OutgoingFile } from "../telegram/gateway.js"
import type { Business, SourceLinkDTO } from "@zumda/core"
import type { Context } from "hono"

/** A link with the address to give out: the shop's bot, told which link was pressed. */
function withUrl(business: Business, link: SourceLinkDTO): SourceLinkDTO & { url: string } {
    return { ...link, url: sourceStartUrl(business.bot.username, link.id) }
}

/** The JPEG the app drew for the post, or none (a post without a photo). */
async function postPhoto(c: Context<AppEnv>): Promise<OutgoingFile | null> {
    if (!c.req.header("Content-Type")?.startsWith("image/")) {
        return null
    }
    return { name: "post.jpg", contentType: "image/jpeg", bytes: await readJpeg(c.req.raw) }
}

/**
 * The shop's own Telegram channel and its links (owner's decision, November 2026): connected from
 * Telegram's own screen, a product posted with «Buyurtma berish», named links for ads elsewhere.
 */
export const channelRoutes = new Hono<AppEnv>()
    .use(requireOwner)

    /** The connected channel and its subscribers (Telegram's count; none when it cannot say). */
    .get("/channel", async (c) => {
        const services = c.get("services")
        const business = shopOf(c)
        const channel = await services.useCases.getShopChannel.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: business.id,
        })
        if (!channel) {
            return c.json({ channel: null })
        }
        const credentials = await services.businesses.getBotCredentials(business.id)
        const subscribers = credentials
            ? await services.telegram
                  .getChatMemberCount(credentials.token, channel.chatId)
                  .catch(() => null)
            : null
        return c.json({ channel: { ...toShopChannelDTO(channel), subscribers } })
    })

    /**
     * «Kanalni bog'lash»: the shop's bot hears `my_chat_member` from now on (a shop connected before
     * gets it here, no «Botni qayta ulash»), then the app opens Telegram's own screen.
     */
    .post("/channel/connect", async (c) => {
        const services = c.get("services")
        const business = shopOf(c)
        if (business.isDemo()) {
            throw BusinessRuleViolationError.demoNotPromoted(business.id)
        }
        const credentials = await services.businesses.getBotCredentials(business.id)
        if (!credentials) {
            throw new ApiError(502, "CHANNEL_SETUP_FAILED", "The shop's bot is not connected")
        }
        try {
            await services.telegram.setWebhook(
                credentials.token,
                `${new URL(c.req.url).origin}/tg/${credentials.botId}`,
                credentials.webhookSecret,
            )
        } catch (error) {
            if (error instanceof TelegramApiError) {
                throw new ApiError(502, "CHANNEL_SETUP_FAILED", "Telegram did not answer")
            }
            throw error
        }
        return c.json({ url: startChannelUrl(business.bot.username) })
    })

    /** «Kanalni ajratish»: Zumda forgets it first, then the bot leaves (its echo changes nothing). */
    .delete("/channel", async (c) => {
        const services = c.get("services")
        const business = shopOf(c)
        const removed = await services.useCases.disconnectShopChannel.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: business.id,
        })
        const credentials = removed
            ? await services.businesses.getBotCredentials(business.id)
            : null
        if (removed && credentials) {
            await services.telegram.leaveChat(credentials.token, removed.chatId).catch(() => {
                // The channel is forgotten either way; the owner may remove the bot by hand.
            })
        }
        return c.body(null, 204)
    })

    /** «Kanalga joylash»: Telegram's own failure is a 502 the app can name. */
    .post(
        "/channel/posts",
        // Telegram's limit is the channel's: counted per shop, whoever of its people posts.
        rateLimit("POST_LIMITER", (c) => shopOf(c).id),
        zValidator("query", channelPostQuery, onInvalid),
        async (c) => {
            const services = c.get("services")
            const business = shopOf(c)
            const { productId, text } = c.req.valid("query")
            const photo = await postPhoto(c)
            try {
                const post = await publishPostUseCase(services, business, photo).execute({
                    actorTelegramId: c.get("auth").user.id,
                    businessId: business.id,
                    productId,
                    ...(text === undefined ? {} : { text }),
                    now: services.clock.now(),
                })
                return c.json(withUrl(business, post), 201)
            } catch (error) {
                if (error instanceof TelegramApiError) {
                    console.warn("Channel post refused", error.description)
                    throw new ApiError(502, "CHANNEL_POST_FAILED", "Telegram did not take the post")
                }
                throw error
            }
        },
    )

    .get("/links", zValidator("query", sourceLinksQuery, onInvalid), async (c) => {
        const services = c.get("services")
        const business = shopOf(c)
        const query = c.req.valid("query")
        const page = await services.useCases.listSourceLinks.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: business.id,
            kind: query.kind,
            page: normalizePage(query),
        })
        return c.json({ ...page, data: page.data.map((link) => withUrl(business, link)) })
    })

    /** «Yangi havola»: a named link for an ad (no channel needed). */
    .post("/links", zValidator("json", adLinkBody, onInvalid), async (c) => {
        const services = c.get("services")
        const business = shopOf(c)
        const body = c.req.valid("json")
        const link = await services.useCases.createAdLink.execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: business.id,
            label: body.label,
            ...(body.productId === undefined ? {} : { productId: body.productId }),
            now: services.clock.now(),
        })
        return c.json(withUrl(business, link), 201)
    })

    /** An ad link stops counting; a post is deleted in the channel first. */
    .delete("/links/:id", zValidator("param", idParam, onInvalid), async (c) => {
        const services = c.get("services")
        const business = shopOf(c)
        await deleteSourceLinkUseCase(services, business).execute({
            actorTelegramId: c.get("auth").user.id,
            businessId: business.id,
            linkId: c.req.valid("param").id,
            now: services.clock.now(),
        })
        return c.body(null, 204)
    })
