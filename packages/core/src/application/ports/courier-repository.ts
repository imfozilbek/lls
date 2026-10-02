import type { CourierProfile } from "../../domain/entities/courier-profile.js"
import type { Courier, CourierInvite } from "../../domain/entities/courier.js"

export interface CourierRepository {
    /** A courier's link to one shop, with the person's profile. */
    findById(id: string): Promise<Courier | null>
    /** The link of this person to this shop (any status). */
    findByTelegramId(businessId: string, telegramId: number): Promise<Courier | null>
    /** The shop's couriers waiting for approval or approved, oldest first. */
    listByBusiness(businessId: string): Promise<Courier[]>
    /** Every shop link of one person (any status), oldest first. */
    listByPerson(telegramId: number): Promise<Courier[]>
    /** Saves the link only; the person's profile is saved with `saveProfile`. */
    save(courier: Courier): Promise<void>
    findProfile(telegramId: number): Promise<CourierProfile | null>
    saveProfile(profile: CourierProfile): Promise<void>
    saveInvite(invite: CourierInvite): Promise<void>
    findInvite(code: string): Promise<CourierInvite | null>
}
