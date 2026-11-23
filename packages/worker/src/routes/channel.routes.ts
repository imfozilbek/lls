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
    relinkBody,
    sourceLinksQuery,
} from "../http/schemas.js"
import { sourceStartUrl, startChannelUrl } from "../telegram/app-links.js"
import { ChannelPageError } from "../telegram/channel-history.js"
import {
    deleteSourceLinkUseCase,
    importChannelHistoryUseCase,
    publishPostUseCase,
} from "../telegram/channel-publisher.js"
import { MAX_VIDEO_BYTES, SHOP_BOT_UPDATES_VERSION, TelegramApiError } from "../telegram/gateway.js"

import type { AppEnv } from "../env.js"
import type { BotCredentials } from "../repositories/business.repository.js"
import type { Services } from "../services.js"
import type { PostUpload } from "../telegram/channel-publisher.js"
import type { Business, ShopChannel, SourceLinkDTO } from "@zumda/core"
import type { Context } from "hono"

/** A link with the address to give out: the shop's bot, told which link was pressed. */
function withUrl(business: Business, link: SourceLinkDTO): SourceLinkDTO & { url: string } {
    return { ...link, url: sourceStartUrl(business.bot.username, link.id) }
}

/** The videos Telegram shows as videos: a phone's mp4, and an iPhone's mov. */
const VIDEO_TYPES: Record<string, string> = {
    "video/mp4": "post.mp4",
    "video/quicktime": "post.mov",
}

/** A video from the owner's phone, streamed on to Telegram: its size must be told and fit. */
function postVideo(c: Context<AppEnv>, type: string): PostUpload {
    const name = VIDEO_TYPES[type]
    const body = c.req.raw.body
    if (!name || !body) {
        throw new ApiError(415, "UNSUPPORTED_VIDEO", "Upload an MP4 or MOV video")
    }
    const size = Number(c.req.header("Content-Length") ?? "")
    if (!Number.isSafeInteger(size) || size <= 0) {
        throw new ApiError(411, "VIDEO_SIZE_UNKNOWN", "The video's size is missing")
    }
    if (size > MAX_VIDEO_BYTES) {
        throw new ApiError(413, "VIDEO_TOO_LARGE", "The video is larger than 50 MB")
    }
    return { kind: "video", video: { name, contentType: type, size, body } }
}

/**
 * What the post carries: the JPEG the app drew (one photo or a collage), a video, or none (a text
 * post).
 */
async function postUpload(c: Context<AppEnv>): Promise<PostUpload | null> {
    const type = c.req.header("Content-Type")?.split(";")[0]?.trim().toLowerCase() ?? ""
    if (type.startsWith("video/")) {
        return postVideo(c, type)
    }
    if (!type.startsWith("image/")) {
        return null
    }
    const file = { name: "post.jpg", contentType: "image/jpeg", bytes: await readJpeg(c.req.raw) }
    return { kind: "photo", file }
}

/** The shop's bot hears Telegram again, with every kind of update Zumda needs of it now. */
async function registerShopWebhook(c: Context<AppEnv>, credentials: BotCredentials): Promise<void> {
    await c
        .get("services")
        .telegram.setWebhook(
            credentials.token,
            `${new URL(c.req.url).origin}/tg/${credentials.botId}`,
            credentials.webhookSecret,
        )
}

/**
 * A channel connected while the bot heard less (before every post came to Zumda) hears it all
 * from the owner's next look at «Telegram kanal»; Telegram not answering waits for the next one.
 */
async function keepUpdatesCurrent(
    c: Context<AppEnv>,
    services: Services,
    channel: ShopChannel,
    credentials: BotCredentials,
): Promise<void> {
    if (channel.updatesVersion >= SHOP_BOT_UPDATES_VERSION) {
        return
    }
    try {
        await registerShopWebhook(c, credentials)
        await services.shopChannels.save(channel.withUpdates(SHOP_BOT_UPDATES_VERSION))
    } catch (error) {
        if (!(error instanceof TelegramApiError)) {
            throw error
        }
        console.warn("Shop bot webhook not renewed", error.description)
    }
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
        if (credentials) {
            await keepUpdatesCurrent(c, services, channel, credentials)
        }
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
            await registerShopWebhook(c, credentials)
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
            const upload = await postUpload(c)
            try {
                const post = await publishPostUseCase(services, business, upload).execute({
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

    /**
     * «Eski postlarni qo'shish»: one page of the channel's past, up to ten posts with their
     * button. The app presses again while `more`, and after `seconds` when Telegram asked to wait.
     */
    .post(
        "/channel/history",
        rateLimit("HISTORY_LIMITER", (c) => shopOf(c).id),
        async (c) => {
            const services = c.get("services")
            const business = shopOf(c)
            try {
                const outcome = await importChannelHistoryUseCase(services, business).execute({
                    actorTelegramId: c.get("auth").user.id,
                    businessId: business.id,
                    now: services.clock.now(),
                })
                return c.json(outcome)
            } catch (error) {
                if (error instanceof TelegramApiError || error instanceof ChannelPageError) {
                    // Where it stopped is kept: the next press goes on from there.
                    console.warn("Channel history not read", error.message)
                    throw new ApiError(502, "CHANNEL_HISTORY_FAILED", "Telegram did not answer")
                }
                throw error
            }
        },
    )

    /** «Mahsulotni tanlash»: the owner's own post leads to another product, or the whole shop. */
    .patch(
        "/links/:id",
        zValidator("param", idParam, onInvalid),
        zValidator("json", relinkBody, onInvalid),
        async (c) => {
            const services = c.get("services")
            const business = shopOf(c)
            const { productId } = c.req.valid("json")
            const link = await services.useCases.relinkChannelPost.execute({
                actorTelegramId: c.get("auth").user.id,
                businessId: business.id,
                linkId: c.req.valid("param").id,
                ...(productId === null ? {} : { productId }),
            })
            return c.json(withUrl(business, link))
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
