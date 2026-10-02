import { FEATURES } from "../../../domain/enums/feature.js"
import { requireOneOf } from "../../../domain/shared/guards.js"
import { BrandColor } from "../../../domain/value-objects/brand-color.js"
import { Location } from "../../../domain/value-objects/location.js"
import { Money } from "../../../domain/value-objects/money.js"
import { PayoutCard } from "../../../domain/value-objects/payout-card.js"
import { WorkingHours } from "../../../domain/value-objects/working-hours.js"
import { toShopOwnerDTO } from "../../dtos/shop.dto.js"
import { districtIdFor } from "../network/network.use-cases.js"
import { requireOwnedBusiness } from "../shared.js"

import type { Business, ProfilePatch } from "../../../domain/entities/business.js"
import type { WeeklySchedule } from "../../../domain/value-objects/working-hours.js"
import type { LocationDTO, ShopOwnerDTO } from "../../dtos/shop.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { DistrictRepository } from "../../ports/district-repository.js"

export interface ShopSettingsPatch {
    name?: string
    brandColor?: string
    logoKey?: string | null
    address?: string | null
    location?: LocationDTO | null
    delivery?: {
        fee: number
        freeFrom?: number | null
        minOrder?: number | null
        radiusMeters?: number | null
    }
    /** `null` = always open. */
    workingHours?: WeeklySchedule | null
    acceptingOrders?: boolean
    /** Vertical toggles the owner switched on. */
    features?: string[]
    /** Deposit per kept returnable bottle, UZS (0 = only count bottles). */
    bottleDeposit?: number
    /** The card for customers' transfers; `null` = cash only. */
    payoutCard?: { number: string; holder: string } | null
    /** When its own couriers are busy, orders go to the district network. */
    networkDelivery?: boolean
}

export interface UpdateShopInput {
    actorTelegramId: number
    businessId: string
    patch: ShopSettingsPatch
}

export class UpdateShopUseCase {
    constructor(
        private readonly businesses: BusinessRepository,
        private readonly clock: Clock,
        /** Without it, a moved shop keeps its district (tests that do not need districts). */
        private readonly districts?: DistrictRepository,
    ) {}

    async execute(input: UpdateShopInput): Promise<ShopOwnerDTO> {
        const business = await requireOwnedBusiness(
            this.businesses,
            input.businessId,
            input.actorTelegramId,
        )
        applyPatch(business, input.patch)
        if (input.patch.location !== undefined && this.districts) {
            business.setDistrict(await districtIdFor(this.districts, business.location))
        }
        await this.businesses.save(business)
        return toShopOwnerDTO(business, this.clock.now())
    }
}

function applyPatch(business: Business, patch: ShopSettingsPatch): void {
    business.updateProfile(toProfilePatch(patch))
    if (patch.delivery) {
        business.updateDelivery({
            fee: Money.of(patch.delivery.fee),
            freeFrom: Money.optional(patch.delivery.freeFrom),
            minOrder: Money.optional(patch.delivery.minOrder),
            radiusMeters: patch.delivery.radiusMeters ?? undefined,
        })
    }
    if (patch.workingHours !== undefined) {
        business.setWorkingHours(WorkingHours.fromJSON(patch.workingHours))
    }
    if (patch.acceptingOrders !== undefined) {
        business.setAcceptingOrders(patch.acceptingOrders)
    }
    if (patch.networkDelivery !== undefined) {
        business.setNetworkDelivery(patch.networkDelivery)
    }
    if (patch.features !== undefined) {
        business.setFeatures(patch.features.map((f) => requireOneOf("features", f, FEATURES)))
    }
    if (patch.bottleDeposit !== undefined) {
        business.setBottleDeposit(Money.of(patch.bottleDeposit))
    }
    if (patch.payoutCard !== undefined) {
        const card = patch.payoutCard
        business.setPayoutCard(card && PayoutCard.create(card.number, card.holder))
    }
}

function toProfilePatch(patch: ShopSettingsPatch): ProfilePatch {
    const profile: ProfilePatch = {
        name: patch.name,
        logoKey: patch.logoKey,
        address: patch.address,
    }
    if (patch.brandColor !== undefined) {
        profile.brandColor = BrandColor.create(patch.brandColor)
    }
    if (patch.location !== undefined) {
        profile.location = patch.location
            ? Location.create(patch.location.latitude, patch.location.longitude)
            : null
    }
    return profile
}
