import { toTelegramUser } from "./updates.js"

import type { Services } from "../services.js"
import type { IncomingMessage } from "./updates.js"

/**
 * Saves the person's phone from a shared contact, in any of the bots. Only the sender's own
 * contact counts: a forwarded contact must not change anyone's phone. Returns false when nothing
 * was saved. With `businessId` the phone is shared with that shop too.
 */
export async function saveOwnPhone(
    services: Services,
    message: IncomingMessage,
    businessId?: string,
): Promise<boolean> {
    const { from, contact } = message
    if (!from || !contact || contact.user_id !== from.id) {
        return false
    }
    // Delivered by Telegram to this bot's webhook: the phone is real.
    await services.useCases.saveContact.execute({
        user: toTelegramUser(from),
        phone: contact.phone_number,
        businessId,
        now: services.clock.now(),
    })
    return true
}
