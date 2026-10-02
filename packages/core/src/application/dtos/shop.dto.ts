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
    /** Switched-on vertical features: reorder, bottle deposit, weight items, stop-list. */
    features: Feature[]
    /** Deposit per kept returnable bottle, UZS. */
    bottleDeposit: number
    /** The card to transfer to; only in the shop's own view, never in the showcase list. */
    payoutCard?: PayoutCardDTO
    /** Customers pay only by transfer: without a card the shop takes no orders yet. */
    hasPayoutCard: boolean
}

export interface PayoutCardDTO {
    /** 16 digits, no spaces. */
    number: string
    holder: string
}

/** What the owner sees in "Мой магазин". */
export interface ShopOwnerDTO extends ShopPublicDTO {
    status: BusinessStatus
    ownerTelegramId: number
    deliveryRadiusMeters?: number
    /** The shop's marketplace deal with LLS, if signed. */
    marketplace?: { commissionBps: number; joinedAt: string }
    /** When its own couriers are busy, orders go to the district network. */
    networkDelivery: boolean
    /** The shop's location is inside a district of the delivery network. */
    inDistrict: boolean
    createdAt: string
}

export function toLocationDTO(
    location: { latitude: number; longitude: number } | undefined,
): LocationDTO | undefined {
    return location ? { latitude: location.latitude, longitude: location.longitude } : undefined
}

function toPayoutCardDTO(business: Business): PayoutCardDTO | undefined {
    const card = business.payoutCard
    return card && { number: card.number, holder: card.holder }
}

/** `withCard`: the shop opened by a customer, who may pay by transfer. Lists never carry it. */
export function toShopPublicDTO(
    business: Business,
    now: Date,
    options: { withCard?: boolean } = {},
): ShopPublicDTO {
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
        features: business.features,
        bottleDeposit: business.bottleDeposit.amount,
        payoutCard: options.withCard ? toPayoutCardDTO(business) : undefined,
        hasPayoutCard: business.acceptsCardTransfers(),
    }
}

export function toShopOwnerDTO(business: Business, now: Date): ShopOwnerDTO {
    return {
        ...toShopPublicDTO(business, now, { withCard: true }),
        status: business.status,
        ownerTelegramId: business.ownerTelegramId.value,
        deliveryRadiusMeters: business.delivery.radiusMeters,
        marketplace: business.marketplace && {
            commissionBps: business.marketplace.commissionBps,
            joinedAt: business.marketplace.joinedAt.toISOString(),
        },
        networkDelivery: business.networkDelivery,
        inDistrict: business.districtId !== undefined,
        createdAt: business.createdAt.toISOString(),
    }
}
