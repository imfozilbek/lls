import type { Courier, CourierInvite } from "../../domain/entities/courier.js"

export interface CourierRepository {
    findById(id: string): Promise<Courier | null>
    /** The courier record of this person in this shop (active or not). */
    findByTelegramId(businessId: string, telegramId: number): Promise<Courier | null>
    /** Active couriers of the shop, oldest first. */
    listActive(businessId: string): Promise<Courier[]>
    save(courier: Courier): Promise<void>
    saveInvite(invite: CourierInvite): Promise<void>
    findInvite(code: string): Promise<CourierInvite | null>
}
