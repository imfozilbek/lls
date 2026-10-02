import { DEFAULT_FEATURES } from "../enums/business-profile.js"
import { BusinessStatus } from "../enums/business-status.js"
import { Feature } from "../enums/feature.js"
import { OrderChannel } from "../enums/order-channel.js"
import { BusinessRuleViolationError } from "../errors/business-rule.error.js"
import { ValidationError } from "../errors/validation.error.js"
import { optionalText, requireInteger, requireText } from "../shared/guards.js"
import { BrandColor } from "../value-objects/brand-color.js"
import { Money } from "../value-objects/money.js"
import { WorkingHours } from "../value-objects/working-hours.js"

import type { BusinessType } from "../enums/business-type.js"
import type { Location } from "../value-objects/location.js"
import type { PayoutCard } from "../value-objects/payout-card.js"
import type { Slug } from "../value-objects/slug.js"
import type { TelegramId } from "../value-objects/telegram-id.js"

const NAME_MAX = 60
const ADDRESS_MAX = 200
const MAX_RADIUS_METERS = 100_000
/** A commission above 50% would be a mistake, not a deal. */
const MAX_COMMISSION_BPS = 5_000
const MAX_BOTTLE_DEPOSIT = 1_000_000

export interface ShopBot {
    id: number
    username: string
}

export interface DeliverySettings {
    fee: Money
    freeFrom?: Money
    minOrder?: Money
    radiusMeters?: number
}

/** The shop's deal with LLS for sales through the marketplace channel. */
export interface MarketplaceTerms {
    /** Commission in basis points of the goods subtotal: 1% = 100. */
    commissionBps: number
    joinedAt: Date
}

export interface BusinessProps {
    id: string
    slug: Slug
    name: string
    type: BusinessType
    ownerTelegramId: TelegramId
    status: BusinessStatus
    bot: ShopBot
    brandColor: BrandColor
    logoKey?: string
    address?: string
    location?: Location
    delivery: DeliverySettings
    workingHours: WorkingHours
    features: Feature[]
    acceptingOrders: boolean
    /** Deposit per returnable bottle the customer keeps. Zero means "just count the bottles". */
    bottleDeposit: Money
    /** Undefined: the shop sells only through its own bot. */
    marketplace?: MarketplaceTerms
    /** The card customers transfer to; without it a shop takes cash only. */
    payoutCard?: PayoutCard
    createdAt: Date
    updatedAt: Date
}

export interface RegisterBusinessInput {
    id: string
    slug: Slug
    name: string
    type: BusinessType
    ownerTelegramId: TelegramId
    bot: ShopBot
    delivery: DeliverySettings
    address?: string
    location?: Location
}

export interface ProfilePatch {
    name?: string
    brandColor?: BrandColor
    logoKey?: string | null
    address?: string | null
    location?: Location | null
}

function validateDelivery(delivery: DeliverySettings): DeliverySettings {
    if (delivery.radiusMeters !== undefined) {
        requireInteger("delivery.radiusMeters", delivery.radiusMeters, 1, MAX_RADIUS_METERS)
    }
    return { ...delivery }
}

export class Business {
    private constructor(private props: BusinessProps) {}

    static register(input: RegisterBusinessInput): Business {
        if (!input.bot.username.trim() || !Number.isSafeInteger(input.bot.id)) {
            throw ValidationError.fromField("bot", "Invalid bot", input.bot)
        }
        const now = new Date()
        return new Business({
            id: input.id,
            slug: input.slug,
            name: requireText("name", input.name, NAME_MAX),
            type: input.type,
            ownerTelegramId: input.ownerTelegramId,
            status: BusinessStatus.PENDING,
            bot: { ...input.bot },
            brandColor: BrandColor.default(),
            address: optionalText("address", input.address, ADDRESS_MAX),
            location: input.location,
            delivery: validateDelivery(input.delivery),
            workingHours: WorkingHours.alwaysOpen(),
            features: [...DEFAULT_FEATURES[input.type]],
            acceptingOrders: true,
            bottleDeposit: Money.zero(),
            createdAt: now,
            updatedAt: now,
        })
    }

    static reconstitute(props: BusinessProps): Business {
        return new Business({ ...props })
    }

    get id(): string {
        return this.props.id
    }
    get slug(): Slug {
        return this.props.slug
    }
    get name(): string {
        return this.props.name
    }
    get type(): BusinessType {
        return this.props.type
    }
    get ownerTelegramId(): TelegramId {
        return this.props.ownerTelegramId
    }
    get status(): BusinessStatus {
        return this.props.status
    }
    get bot(): ShopBot {
        return { ...this.props.bot }
    }
    get brandColor(): BrandColor {
        return this.props.brandColor
    }
    get logoKey(): string | undefined {
        return this.props.logoKey
    }
    get address(): string | undefined {
        return this.props.address
    }
    get location(): Location | undefined {
        return this.props.location
    }
    get delivery(): DeliverySettings {
        return { ...this.props.delivery }
    }
    get workingHours(): WorkingHours {
        return this.props.workingHours
    }
    get features(): Feature[] {
        return [...this.props.features]
    }
    get acceptingOrders(): boolean {
        return this.props.acceptingOrders
    }
    get bottleDeposit(): Money {
        return this.props.bottleDeposit
    }
    get payoutCard(): PayoutCard | undefined {
        return this.props.payoutCard
    }
    /** Transfers need the shop's card. */
    acceptsCardTransfers(): boolean {
        return this.props.payoutCard !== undefined
    }
    get marketplace(): MarketplaceTerms | undefined {
        return this.props.marketplace ? { ...this.props.marketplace } : undefined
    }
    get createdAt(): Date {
        return this.props.createdAt
    }
    get updatedAt(): Date {
        return this.props.updatedAt
    }

    isOwnedBy(telegramId: number): boolean {
        return this.props.ownerTelegramId.value === telegramId
    }

    isPending(): boolean {
        return this.props.status === BusinessStatus.PENDING
    }

    isActive(): boolean {
        return this.props.status === BusinessStatus.ACTIVE
    }

    hasFeature(feature: Feature): boolean {
        return this.props.features.includes(feature)
    }

    approve(): void {
        if (this.isActive()) {
            throw BusinessRuleViolationError.shopAlreadyActive(this.props.id)
        }
        this.props.status = BusinessStatus.ACTIVE
        this.touch()
    }

    disable(): void {
        this.props.status = BusinessStatus.DISABLED
        this.touch()
    }

    /** Throws if a customer cannot place an order right now. */
    assertCanAcceptOrders(now: Date): void {
        if (!this.isActive()) {
            throw BusinessRuleViolationError.shopNotActive(this.props.id)
        }
        if (!this.props.acceptingOrders) {
            throw BusinessRuleViolationError.notAcceptingOrders(this.props.id)
        }
        if (!this.props.workingHours.isOpenAt(now)) {
            throw BusinessRuleViolationError.shopClosed(this.props.id)
        }
    }

    isOpenAt(now: Date): boolean {
        return (
            this.isActive() && this.props.acceptingOrders && this.props.workingHours.isOpenAt(now)
        )
    }

    assertMinOrder(subtotal: Money): void {
        const { minOrder } = this.props.delivery
        if (minOrder && subtotal.isLessThan(minOrder)) {
            throw BusinessRuleViolationError.minOrderNotReached(minOrder.amount, subtotal.amount)
        }
    }

    /** Only checked when the shop set a radius and both points are known. */
    assertDeliversTo(destination: Location | undefined): void {
        const { radiusMeters } = this.props.delivery
        if (radiusMeters === undefined || !this.props.location || !destination) {
            return
        }
        const distance = this.props.location.distanceTo(destination)
        if (distance > radiusMeters) {
            throw BusinessRuleViolationError.outsideDeliveryZone(distance)
        }
    }

    deliveryFeeFor(subtotal: Money): Money {
        const { fee, freeFrom } = this.props.delivery
        if (freeFrom && subtotal.isAtLeast(freeFrom)) {
            return Money.zero()
        }
        return fee
    }

    updateProfile(patch: ProfilePatch): void {
        if (patch.name !== undefined) {
            this.props.name = requireText("name", patch.name, NAME_MAX)
        }
        if (patch.brandColor !== undefined) {
            this.props.brandColor = patch.brandColor
        }
        if (patch.logoKey !== undefined) {
            this.props.logoKey = patch.logoKey ?? undefined
        }
        if (patch.address !== undefined) {
            this.props.address = optionalText("address", patch.address, ADDRESS_MAX)
        }
        if (patch.location !== undefined) {
            this.props.location = patch.location ?? undefined
        }
        this.touch()
    }

    updateDelivery(delivery: DeliverySettings): void {
        this.props.delivery = validateDelivery(delivery)
        this.touch()
    }

    setWorkingHours(hours: WorkingHours): void {
        this.props.workingHours = hours
        this.touch()
    }

    setAcceptingOrders(accepting: boolean): void {
        this.props.acceptingOrders = accepting
        this.touch()
    }

    setFeatures(features: Feature[]): void {
        this.props.features = [...new Set(features)]
        this.touch()
    }

    /** `null` removes the card: the shop takes cash only. */
    setPayoutCard(card: PayoutCard | null): void {
        this.props.payoutCard = card ?? undefined
        this.touch()
    }

    setBottleDeposit(amount: Money): void {
        requireInteger("bottleDeposit", amount.amount, 0, MAX_BOTTLE_DEPOSIT)
        this.props.bottleDeposit = amount
        this.touch()
    }

    /**
     * Deposit for bottles the customer keeps: returnable bottles ordered minus empty ones given back.
     * Only for shops with the bottle feature; everyone else pays nothing extra.
     */
    depositFor(returnableOrdered: number, bottlesReturned: number): Money {
        if (!this.hasFeature(Feature.BOTTLE_DEPOSIT)) {
            return Money.zero()
        }
        return this.props.bottleDeposit.multiply(Math.max(0, returnableOrdered - bottlesReturned))
    }

    /** Shown in the LLS showcase: an active shop with a signed marketplace deal. */
    isInShowcase(): boolean {
        return this.isActive() && this.props.marketplace !== undefined
    }

    /** Signs the marketplace deal: the shop appears in the LLS showcase with this commission. */
    joinMarketplace(commissionBps: number, now: Date): void {
        this.props.marketplace = {
            commissionBps: requireInteger("commissionBps", commissionBps, 0, MAX_COMMISSION_BPS),
            joinedAt: now,
        }
        this.touch()
    }

    leaveMarketplace(): void {
        this.props.marketplace = undefined
        this.touch()
    }

    /** Own-bot sales are never commissioned. Marketplace sales need a signed deal. */
    commissionBpsFor(channel: OrderChannel): number {
        if (channel === OrderChannel.SHOP_BOT) {
            return 0
        }
        if (!this.props.marketplace) {
            throw BusinessRuleViolationError.notInMarketplace(this.props.id)
        }
        return this.props.marketplace.commissionBps
    }

    private touch(): void {
        this.props.updatedAt = new Date()
    }
}
