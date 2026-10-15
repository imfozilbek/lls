import type { Business } from "../../../domain/entities/business.js"
import type { Phone } from "../../../domain/value-objects/phone.js"
import type { CustomerRepository } from "../../ports/customer-repository.js"

/**
 * The number customers and couriers call the shop on (owner's decision, October 2026): the
 * shop's own «Mijozlar uchun telefon», or, while it is empty, the phone the owner shared with
 * Zumda. The owner is read only when the shop has no number of its own.
 */
export async function shopCallPhone(
    business: Business,
    customers: Pick<CustomerRepository, "findByTelegramId">,
): Promise<Phone | undefined> {
    if (business.contactPhone) {
        return business.contactPhone
    }
    const owner = await customers.findByTelegramId(business.ownerTelegramId.value)
    return owner?.phone
}
