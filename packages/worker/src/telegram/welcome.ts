import { TelegramApiError } from "./gateway.js"

import type { MessageOptions, TelegramGateway } from "./gateway.js"

/** The street picture under `packages/app/public/welcome/`, served by the Mini App. */
export const WELCOME_PICTURE = {
    platform: "/welcome/zumda.jpg",
    courier: "/welcome/kuryer.jpg",
} as const

export type WelcomeBot = keyof typeof WELCOME_PICTURE

export function welcomePictureUrl(appOrigin: string, bot: WelcomeBot): string {
    return `${appOrigin}${WELCOME_PICTURE[bot]}`
}

export interface Welcome {
    token: string
    chatId: number
    pictureUrl: string
    html: string
    options?: MessageOptions
}

/**
 * The /start greeting of a Zumda bot: the picture with the text as its caption and the buttons.
 * When Telegram cannot take the picture (it could not download it), the same text goes alone:
 * a greeting is never lost.
 */
export async function sendWelcome(telegram: TelegramGateway, welcome: Welcome): Promise<void> {
    const { token, chatId, pictureUrl, html, options } = welcome
    try {
        await telegram.sendPhoto(token, chatId, pictureUrl, html, options)
    } catch (error) {
        // A blocked bot cannot send text either: nothing to fall back to.
        if (!(error instanceof TelegramApiError) || error.description.startsWith("Forbidden")) {
            throw error
        }
        console.warn(`Welcome picture failed, sending text only: ${error.message}`)
        await telegram.sendMessage(token, chatId, html, options)
    }
}
