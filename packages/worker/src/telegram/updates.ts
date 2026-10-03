import { BusinessRuleViolationError, DomainError, ForbiddenError } from "@zumda/core"
import { z } from "zod"

import { TelegramApiError } from "./gateway.js"

import type { InlineKeyboard } from "./gateway.js"
import type { BotTexts } from "./texts.js"
import type { TelegramUser } from "@zumda/core"

/** What every bot webhook shares: the update shape, the secret header, safe handling. */
export const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"

const userSchema = z.object({
    id: z.number().int(),
    first_name: z.string().default(""),
    last_name: z.string().optional(),
    username: z.string().optional(),
    language_code: z.string().optional(),
})

const updateSchema = z.object({
    message: z
        .object({
            from: userSchema.optional(),
            chat: z.object({ id: z.number().int() }),
            text: z.string().optional(),
            contact: z
                .object({ phone_number: z.string(), user_id: z.number().int().optional() })
                .optional(),
        })
        .optional(),
    /** Managed Bots: a bot was created for us to manage, or its token or owner changed. */
    managed_bot: z
        .object({
            user: userSchema,
            bot: z.object({ id: z.number().int(), username: z.string().min(1) }),
        })
        .optional(),
    callback_query: z
        .object({
            id: z.string(),
            from: userSchema,
            data: z.string().optional(),
            message: z
                .object({ message_id: z.number().int(), chat: z.object({ id: z.number().int() }) })
                .optional(),
        })
        .optional(),
})

export type Update = z.infer<typeof updateSchema>
export type Callback = NonNullable<Update["callback_query"]>
export type IncomingMessage = NonNullable<Update["message"]>
export type ManagedBotUpdate = NonNullable<Update["managed_bot"]>

export function toTelegramUser(user: z.infer<typeof userSchema>): TelegramUser {
    return {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        languageCode: user.language_code,
    }
}

export async function readUpdate(request: Request): Promise<Update | null> {
    const parsed = updateSchema.safeParse(await request.json().catch(() => null))
    return parsed.success ? parsed.data : null
}

export function isStart(text: string | undefined): boolean {
    return text?.trim().startsWith("/start") ?? false
}

export function openButton(label: string, url: string): InlineKeyboard {
    return { inline_keyboard: [[{ text: label, web_app: { url } }]] }
}

export function callbackErrorText(error: unknown, texts: BotTexts): string {
    if (error instanceof ForbiddenError) {
        return texts.callbackForbidden
    }
    if (error instanceof BusinessRuleViolationError && error.rule === "NETWORK_ORDER_TAKEN") {
        return texts.callbackTaken
    }
    if (error instanceof DomainError) {
        return texts.callbackOutdated
    }
    throw error
}

/**
 * Runs an update handler. A failed reply (bot blocked, query too old, Telegram down) is logged,
 * not thrown: the update is already applied, and a 500 would make Telegram resend it for hours.
 */
export async function handleSafely(work: () => Promise<void>): Promise<void> {
    try {
        await work()
    } catch (error) {
        if (!(error instanceof TelegramApiError)) {
            throw error
        }
        console.error("Telegram reply failed:", error.message)
    }
}
