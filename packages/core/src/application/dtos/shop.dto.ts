import type { Business } from "../../domain/entities/business.js"
import type { BusinessStatus } from "../../domain/enums/business-status.js"
import type { BusinessType } from "../../domain/enums/business-type.js"
import type { Feature } from "../../domain/enums/feature.js"
import type { WeeklySchedule } from "../../domain/value-objects/working-hours.js"

export interface LocationDTO {
    latitude: number
    longitude: number
}

/** What a customer sees. */
export interface ShopPublicDTO {
    id: string
    slug: string
    name: string
    type: BusinessType
    brandColor: string
    logoKey?: string
    address?: string
    location?: LocationDTO
    delivery: {
        fee: number
        freeFrom?: number
        minOrder?: number
    }
    workingHours: WeeklySchedule | null
    acceptingOrders: boolean
    isOpen: boolean
    botUsername: string
}

/** What the owner sees in "Мой магазин". */
export interface ShopOwnerDTO extends ShopPublicDTO {
    status: BusinessStatus
    ownerTelegramId: number
    features: Feature[]
    deliveryRadiusMeters?: number
    createdAt: string
}

export function toLocationDTO(
    location: { latitude: number; longitude: number } | undefined,
): LocationDTO | undefined {
    return location ? { latitude: location.latitude, longitude: location.longitude } : undefined
}

export function toShopPublicDTO(business: Business, now: Date): ShopPublicDTO {
    const { fee, freeFrom, minOrder } = business.delivery
    return {
        id: business.id,
        slug: business.slug.value,
        name: business.name,
        type: business.type,
        brandColor: business.brandColor.hex,
        logoKey: business.logoKey,
        address: business.address,
        location: toLocationDTO(business.location),
        delivery: { fee: fee.amount, freeFrom: freeFrom?.amount, minOrder: minOrder?.amount },
        workingHours: business.workingHours.toJSON(),
        acceptingOrders: business.acceptingOrders,
        isOpen: business.isOpenAt(now),
        botUsername: business.bot.username,
    }
}

export function toShopOwnerDTO(business: Business, now: Date): ShopOwnerDTO {
    return {
        ...toShopPublicDTO(business, now),
        status: business.status,
        ownerTelegramId: business.ownerTelegramId.value,
        features: business.features,
        deliveryRadiusMeters: business.delivery.radiusMeters,
        createdAt: business.createdAt.toISOString(),
    }
}
