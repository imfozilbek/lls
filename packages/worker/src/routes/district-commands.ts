import { DomainError, languageFromTelegram } from "@zumda/core"

import { platformAdminIds } from "../env.js"
import { reportOverdueNetworkOrders } from "../network-flow.js"
import { escapeHtml } from "../telegram/gateway.js"
import { fill, textsFor } from "../telegram/texts.js"

import type { Services } from "../services.js"
import type { IncomingMessage } from "../telegram/updates.js"

const NAME = String.raw`([\p{L}\p{N}' -]{2,60}?)`
/** `/district Guliston 40.4897,68.7842 30`: create or move a district (center, radius in km). */
const DISTRICT_PLACE = new RegExp(
    String.raw`^\/district(?:@\w+)?\s+${NAME}\s+(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s+(\d{1,3}(?:[.,]\d)?)\s*$`,
    "iu",
)
/** `/district Guliston wait 15`: how many minutes a network order may wait. */
const DISTRICT_WAIT = new RegExp(
    String.raw`^\/district(?:@\w+)?\s+${NAME}\s+wait\s+(\d{1,3})\s*$`,
    "iu",
)
const METERS_PER_KM = 1000

function isAdmin(services: Services, message: IncomingMessage): boolean {
    return message.from !== undefined && platformAdminIds(services.env).includes(message.from.id)
}

interface DistrictCommand {
    name: string
    center?: { latitude: number; longitude: number }
    radiusKm?: number
    waitMinutes?: number
}

function parseDistrictCommand(text: string): DistrictCommand | null {
    const place = DISTRICT_PLACE.exec(text)
    if (place?.[1]) {
        return {
            name: place[1].trim(),
            center: { latitude: Number(place[2]), longitude: Number(place[3]) },
            radiusKm: Number(place[4]?.replace(",", ".")),
        }
    }
    const wait = DISTRICT_WAIT.exec(text)
    return wait?.[1] ? { name: wait[1].trim(), waitMinutes: Number(wait[2]) } : null
}

/** `/district …` from a platform admin. Everyone else gets no hint that the command exists. */
export async function handleDistrictCommand(
    services: Services,
    message: IncomingMessage,
): Promise<void> {
    const from = message.from
    if (!from || !isAdmin(services, message)) {
        return
    }
    const token = services.env.BUSINESS_BOT_TOKEN
    const t = textsFor(languageFromTelegram(from.language_code))
    const command = parseDistrictCommand(message.text?.trim() ?? "")
    if (!command) {
        await services.telegram.sendMessage(token, message.chat.id, t.districtUsage)
        return
    }
    try {
        const { district, shops } = await services.useCases.setDistrict.execute({
            actorTelegramId: from.id,
            ...command,
        })
        await services.telegram.sendMessage(
            token,
            message.chat.id,
            fill(t.districtSaved, {
                name: `<b>${escapeHtml(district.name)}</b>`,
                km: district.radiusMeters / METERS_PER_KM,
                min: district.waitMinutes,
                shops,
            }),
        )
    } catch (error) {
        if (!(error instanceof DomainError)) {
            throw error
        }
        await services.telegram.sendMessage(token, message.chat.id, escapeHtml(error.message))
    }
}

/** `/network` from a platform admin: each district now and over the last week. */
export async function handleNetworkCommand(
    services: Services,
    message: IncomingMessage,
): Promise<void> {
    const from = message.from
    if (!from || !isAdmin(services, message)) {
        return
    }
    const t = textsFor(languageFromTelegram(from.language_code))
    const stats = await services.useCases.networkStats.execute({ actorTelegramId: from.id })
    const lines =
        stats.length === 0
            ? [t.networkNoDistricts]
            : [
                  `<b>${t.networkReportTitle}</b>`,
                  ...stats.map((d) =>
                      fill(t.networkReportLine, {
                          name: escapeHtml(d.name),
                          km: d.radiusKm,
                          free: d.freeCouriers,
                          waiting: d.waiting,
                          delivered: d.delivered,
                          network: d.viaNetwork,
                      }),
                  ),
              ]
    await services.telegram.sendMessage(
        services.env.BUSINESS_BOT_TOKEN,
        message.chat.id,
        lines.join("\n"),
    )
    await reportOverdueNetworkOrders(services)
}
