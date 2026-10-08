import { TelegramApiError } from "./gateway.js"

import type { MessageOptions, TelegramGateway, VideoLink } from "./gateway.js"

/** The street picture under `packages/app/public/welcome/`, served by the Mini App. */
export const WELCOME_PICTURE = {
    platform: "/welcome/zumda.jpg",
    // The same street, signed «zumda Business»: the bot for the owners of these places.
    business: "/welcome/biznes.jpg",
    courier: "/welcome/kuryer.jpg",
} as const

export type WelcomeBot = keyof typeof WELCOME_PICTURE

/**
 * The instruction of each bot's role (owner's decision, October 2026): a short video of the real
 * screens, next to the picture under `packages/app/public/welcome/` (source: `brand/welcome/video/`).
 */
const WELCOME_VIDEO: Record<WelcomeBot, { path: string; cover: string; durationS: number }> = {
    platform: { path: "/welcome/zumda.mp4", cover: "/welcome/zumda-cover.jpg", durationS: 40 },
    business: { path: "/welcome/biznes.mp4", cover: "/welcome/biznes-cover.jpg", durationS: 47 },
    courier: { path: "/welcome/kuryer.mp4", cover: "/welcome/kuryer-cover.jpg", durationS: 35 },
}
const VIDEO_WIDTH = 720
const VIDEO_HEIGHT = 1280

export function welcomePictureUrl(appOrigin: string, bot: WelcomeBot): string {
    return `${appOrigin}${WELCOME_PICTURE[bot]}`
}

export function welcomeVideo(appOrigin: string, bot: WelcomeBot): VideoLink {
    const video = WELCOME_VIDEO[bot]
    return {
        url: `${appOrigin}${video.path}`,
        coverUrl: `${appOrigin}${video.cover}`,
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        durationS: video.durationS,
    }
}

export interface Welcome {
    token: string
    chatId: number
    pictureUrl: string
    /** The instruction video: sent instead of the picture when there is one. */
    video?: VideoLink
    html: string
    options?: MessageOptions
}

/** Telegram could not take this media (a download, a size): the next, simpler one goes instead. */
function canFallBack(error: unknown): boolean {
    // A blocked bot cannot send anything else either: nothing to fall back to.
    return error instanceof TelegramApiError && !error.description.startsWith("Forbidden")
}

/**
 * The /start greeting of a Zumda bot: the video (or the picture) with the text as its caption and
 * the buttons. When Telegram cannot take the video, the picture goes; when not the picture
 * either, the same text alone: a greeting is never lost.
 */
export async function sendWelcome(telegram: TelegramGateway, welcome: Welcome): Promise<void> {
    const { token, chatId, pictureUrl, video, html, options } = welcome
    if (video) {
        try {
            await telegram.sendVideo(token, chatId, video, html, options)
            return
        } catch (error) {
            if (!canFallBack(error)) {
                throw error
            }
            console.warn(`Welcome video failed, sending the picture: ${String(error)}`)
        }
    }
    try {
        await telegram.sendPhoto(token, chatId, pictureUrl, html, options)
    } catch (error) {
        if (!canFallBack(error)) {
            throw error
        }
        console.warn(`Welcome picture failed, sending text only: ${String(error)}`)
        await telegram.sendMessage(token, chatId, html, options)
    }
}
