import { refreshPostButtons } from "./channel-publisher.js"
import { Notifier } from "./notifier.js"

import type { Services } from "../services.js"
import type { Business } from "@zumda/core"

/**
 * The shop's support group came or went (goal 23): the bot's description and the newest channel
 * posts say whether customers may ask here. Neither stops what the group change itself does.
 */
export async function supportReachChanged(services: Services, business: Business): Promise<void> {
    await new Notifier(services).shopBotDescriptions(business).catch((error: unknown) => {
        console.warn("Shop bot description not refreshed", String(error))
    })
    await refreshPostButtons(services, business).catch((error: unknown) => {
        console.warn("Post buttons not refreshed", String(error))
    })
}
