import { Language } from "@zumda/core"

import { platformAdminIds } from "./env.js"
import { TelegramApiError, escapeHtml } from "./telegram/gateway.js"
import { fill, textsFor } from "./telegram/texts.js"

import type { Services } from "./services.js"

/** At most one alert of a kind per this period, across all Worker instances. */
export const ALERT_QUIET_MS = 10 * 60 * 1000
const MAX_DETAIL_LENGTH = 300
/** Bot tokens look like `123456:AAH...`; they must never reach a chat. */
const BOT_TOKEN_PATTERN = /\d{5,}:[\w-]{30,}/g

export type AlertKind = "server_error" | "notification_failed"

/**
 * Telegram answers "Forbidden" when a person blocked the bot or never started it, and
 * "chat not found" for a chat the bot cannot see. That is normal life, not an incident.
 */
export function isRecipientProblem(error: unknown): boolean {
    return (
        error instanceof TelegramApiError &&
        (error.description.startsWith("Forbidden") || error.description.includes("chat not found"))
    )
}

/** Short, token-free description of an error for the admins. */
export function describeError(error: unknown): string {
    const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    return text.replace(BOT_TOKEN_PATTERN, "<token>").slice(0, MAX_DETAIL_LENGTH)
}

/**
 * Tells the platform admins through the Zumda Business bot. Never throws: an alert must not break the
 * request, and a broken database or Telegram only leaves the error in the Worker log.
 */
export async function alertAdmins(
    services: Services,
    kind: AlertKind,
    error: unknown,
): Promise<void> {
    try {
        if (!(await claimAlert(services, kind))) {
            return
        }
        const detail = escapeHtml(describeError(error))
        for (const adminId of platformAdminIds(services.env)) {
            const customer = await services.customers.findByTelegramId(adminId)
            const texts = textsFor(customer?.language ?? Language.UZ)
            const title =
                kind === "server_error" ? texts.alertServerError : texts.alertNotificationFailed
            const quiet = fill(texts.alertQuiet, { minutes: ALERT_QUIET_MS / 60_000 })
            await services.telegram.sendMessage(
                services.env.BUSINESS_BOT_TOKEN,
                adminId,
                `<b>${title}</b>\n<code>${detail}</code>\n\n${quiet}`,
            )
        }
    } catch (alertError) {
        console.error("Admin alert failed", describeError(alertError))
    }
}

/** True for the one caller that may send this kind now; one atomic write decides. */
async function claimAlert(services: Services, kind: AlertKind): Promise<boolean> {
    const now = services.clock.now().getTime()
    const result = await services.env.DB.prepare(
        `INSERT INTO alert_log (kind, sent_at) VALUES (?1, ?2)
         ON CONFLICT (kind) DO UPDATE SET sent_at = excluded.sent_at
         WHERE alert_log.sent_at <= ?3`,
    )
        .bind(kind, now, now - ALERT_QUIET_MS)
        .run()
    return result.meta.changes === 1
}
