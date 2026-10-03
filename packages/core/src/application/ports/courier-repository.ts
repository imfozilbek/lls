import type { CourierProfile } from "../../domain/entities/courier-profile.js"
import type { Courier, CourierInvite } from "../../domain/entities/courier.js"

export interface CourierRepository {
    /** A courier's link to one shop, with the person's profile. */
    findById(id: string): Promise<Courier | null>
    /** The link of this person to this shop (any status). */
    findByTelegramId(businessId: string, telegramId: number): Promise<Courier | null>
    /** The shop's own couriers, waiting for approval or approved, oldest first (no network links). */
    listByBusiness(businessId: string): Promise<Courier[]>
    /** Every shop link of one person (any status), oldest first. */
    listByPerson(telegramId: number): Promise<Courier[]>
    /** Saves the link only; the person's profile is saved with `saveProfile`. */
    save(courier: Courier): Promise<void>
    findProfile(telegramId: number): Promise<CourierProfile | null>
    saveProfile(profile: CourierProfile): Promise<void>
    /**
     * People who may take a network order of this district now: in the network, on shift,
     * approved by a shop of the district, and not carrying another network order. Oldest first.
     */
    listFreeNetworkCouriers(districtId: string, now: Date, limit: number): Promise<CourierProfile[]>
    saveInvite(invite: CourierInvite): Promise<void>
    /**
     * Marks a used invite only if nobody used it in between: one conditional write, so two
     * people opening the same link at once never both get in.
     */
    claimInvite(invite: CourierInvite): Promise<boolean>
    findInvite(code: string): Promise<CourierInvite | null>
}
