import { ApiError } from "./api.js"
import { drawBotAvatar } from "./bot-avatar.js"

import type { BotAvatarInput } from "./bot-avatar.js"

/** Telegram refused the picture, or the device could not draw it. */
export const BOT_PHOTO_FAILED = "BOT_PHOTO_FAILED"

/**
 * Draws the shop bot's picture and hands it to `send` (the owner's or the onboarding endpoint).
 * Returns null when Telegram has it, else the error code for a toast: the shop itself is saved
 * either way, so a failed picture never blocks the owner.
 */
export async function updateBotPhoto(
    input: BotAvatarInput,
    send: (jpeg: Blob) => Promise<void>,
): Promise<string | null> {
    try {
        await send(await drawBotAvatar(input))
        return null
    } catch (caught) {
        return caught instanceof ApiError ? caught.code : BOT_PHOTO_FAILED
    }
}
