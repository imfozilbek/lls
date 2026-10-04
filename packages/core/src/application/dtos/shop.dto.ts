import { BotSource } from "../../domain/enums/bot-source.js"

import type { Business } from "../../domain/entities/business.js"
import type { Customer } from "../../domain/entities/customer.js"
import type { PayoutCardBook } from "../../domain/entities/payout-card-book.js"
import type { BusinessStatus } from "../../domain/enums/business-status.js"
import type { BusinessType } from "../../domain/enums/business-type.js"
import type { Feature } from "../../domain/enums/feature.js"
import type { OwnerChat } from "../../domain/enums/owner-chat.js"
import type { PaymentMethod, PaymentOptions } from "../../domain/enums/payment.js"
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
    /** E.164: the number customers call about an order, when the owner gave one. */
    contactPhone?: string
    delivery: {
        fee: number
        freeFrom?: number
        minOrder?: number
        /** Set with the shop's location: orders come only from inside it, with the pin. */
        radiusMeters?: number
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
    /** The shop has a payment card customers may be shown. */
    hasPayoutCard: boolean
    /** Which ways of paying the owner chose. */
    paymentOptions: PaymentOptions
    /** The ways a customer may pay now, the card first. Empty: the shop takes no orders yet. */
    paymentMethods: PaymentMethod[]
    /** Waiting for Zumda's approval: the storefront opens, orders do not («Tez orada ochiladi»). */
    opensSoon: boolean
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
    /** Created from the Zumda bot (Managed Bots): Zumda holds its token, the owner never did. */
    managedBot: boolean
    deliveryRadiusMeters?: number
    /** The shop's marketplace deal with Zumda, if signed. */
    marketplace?: { commissionBps: number; joinedAt: string }
    /** When its own couriers are busy, orders go to the district network. */
    networkDelivery: boolean
    /** The shop's location is inside a district of the delivery network. */
    inDistrict: boolean
    /** A rejected application: why, so the owner can fix it and apply again. */
    rejection?: { at: string; reason?: string }
    /** Can the shop's own bot write to the owner (pressed Start in it)? */
    ownerChat: OwnerChat
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
        contactPhone: business.contactPhone?.number,
        delivery: {
            fee: fee.amount,
            freeFrom: freeFrom?.amount,
            minOrder: minOrder?.amount,
            radiusMeters: business.location ? business.delivery.radiusMeters : undefined,
        },
        workingHours: business.workingHours.toJSON(),
        acceptingOrders: business.acceptingOrders,
        isOpen: business.isOpenAt(now),
        botUsername: business.bot.username,
        features: business.features,
        bottleDeposit: business.bottleDeposit.amount,
        payoutCard: options.withCard ? toPayoutCardDTO(business) : undefined,
        hasPayoutCard: business.hasPayoutCard(),
        paymentOptions: business.paymentOptions,
        paymentMethods: business.paymentMethods(),
        opensSoon: business.isPending(),
    }
}

export function toShopOwnerDTO(business: Business, now: Date): ShopOwnerDTO {
    return {
        ...toShopPublicDTO(business, now, { withCard: true }),
        status: business.status,
        ownerTelegramId: business.ownerTelegramId.value,
        managedBot: business.botSource === BotSource.MANAGED,
        deliveryRadiusMeters: business.delivery.radiusMeters,
        marketplace: business.marketplace && {
            commissionBps: business.marketplace.commissionBps,
            joinedAt: business.marketplace.joinedAt.toISOString(),
        },
        networkDelivery: business.networkDelivery,
        inDistrict: business.districtId !== undefined,
        rejection: business.rejection && {
            at: business.rejection.at.toISOString(),
            reason: business.rejection.reason,
        },
        ownerChat: business.ownerChat,
        createdAt: business.createdAt.toISOString(),
    }
}

/**
 * A shop in the admin's «Platforma»: the owner's view without the card, plus who the owner is
 * (name and phone, when they shared it with Zumda).
 */
export interface PlatformShopDTO extends Omit<ShopOwnerDTO, "payoutCard"> {
    owner: { name?: string; phone?: string }
}

export function toPlatformShopDTO(
    business: Business,
    owner: Customer | undefined,
    now: Date,
): PlatformShopDTO {
    const { payoutCard: _card, ...shop } = toShopOwnerDTO(business, now)
    return { ...shop, owner: { name: owner?.name, phone: owner?.phone?.number } }
}

/** The owner's cards: all of them, and which one customers are shown. */
export interface PayoutCardsDTO {
    paymentCardId?: string
    cards: SavedPayoutCardDTO[]
}

export interface SavedPayoutCardDTO extends PayoutCardDTO {
    id: string
}

export function toPayoutCardsDTO(book: PayoutCardBook, business: Business): PayoutCardsDTO {
    return {
        paymentCardId: business.paymentCardId,
        cards: book.list().map((saved) => ({
            id: saved.id,
            number: saved.card.number,
            holder: saved.card.holder,
        })),
    }
}
