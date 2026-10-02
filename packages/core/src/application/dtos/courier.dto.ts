import type { OrderDTO } from "./order.dto.js"
import type { CourierProfile } from "../../domain/entities/courier-profile.js"
import type { Courier, CourierUnavailableReason } from "../../domain/entities/courier.js"
import type { CourierStatus } from "../../domain/enums/courier-status.js"
import type { Weekday } from "../../domain/value-objects/working-hours.js"

/** A courier as the shop owner sees them: only this shop, never their other shops. */
export interface CourierDTO {
    id: string
    name: string
    phone?: string
    vehicle?: string
    status: CourierStatus
    isActive: boolean
    workDays: Weekday[]
    offToday: boolean
    onShift: boolean
    /** Why a new order cannot go to this courier now, or null when it can. */
    unavailableReason: CourierUnavailableReason | null
    createdAt: string
}

export function toCourierDTO(courier: Courier, now: Date): CourierDTO {
    return {
        id: courier.id,
        name: courier.name,
        phone: courier.phone?.number,
        vehicle: courier.profile.vehicle,
        status: courier.status,
        isActive: courier.isActive,
        workDays: [...courier.workDays],
        offToday: courier.isOffToday(now),
        onShift: courier.profile.isOnShift(now),
        unavailableReason: courier.unavailableReason(now),
        createdAt: courier.createdAt.toISOString(),
    }
}

/** The courier's own profile in the LLS courier bot. */
export interface CourierProfileDTO {
    name: string
    phone?: string
    vehicle?: string
    onShift: boolean
}

export function toCourierProfileDTO(profile: CourierProfile, now: Date): CourierProfileDTO {
    return {
        name: profile.name,
        phone: profile.phone?.number,
        vehicle: profile.vehicle,
        onShift: profile.isOnShift(now),
    }
}

/** One shop the courier works for, as the courier sees it. */
export interface CourierShopDTO {
    businessId: string
    shopName: string
    status: CourierStatus
    workDays: Weekday[]
    /** Works for this shop today: approved, a working day, not switched off for today. */
    worksToday: boolean
    /** Cash of this shop the courier holds: taken at doors minus handed over. */
    onHand: number
}

export interface CourierOrderDTO extends OrderDTO {
    shopName: string
}

/** Everything on the courier's screen, across all their shops. */
export interface CourierHomeDTO {
    profile: CourierProfileDTO
    shops: CourierShopDTO[]
    orders: CourierOrderDTO[]
}
