import { FEATURES } from "../../../domain/enums/feature.js"
import { PAYMENT_OPTIONS } from "../../../domain/enums/payment.js"
import { STOREFRONT_LAYOUTS } from "../../../domain/enums/storefront-layout.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { requireOneOf } from "../../../domain/shared/guards.js"
import { BrandColor } from "../../../domain/value-objects/brand-color.js"
import { Location } from "../../../domain/value-objects/location.js"
import { Money } from "../../../domain/value-objects/money.js"
import { Phone } from "../../../domain/value-objects/phone.js"
import { WorkingHours } from "../../../domain/value-objects/working-hours.js"
import { toShopOwnerDTO } from "../../dtos/shop.dto.js"
import { districtIdFor } from "../network/network.use-cases.js"
import { requireOwnedBusiness } from "../shared.js"

import type { Business, ProfilePatch } from "../../../domain/entities/business.js"
import type { DeliveryPriceChoice } from "../../../domain/enums/delivery-price.js"
import type { WeeklySchedule } from "../../../domain/value-objects/working-hours.js"
import type { LocationDTO, ShopOwnerDTO } from "../../dtos/shop.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { DistrictRepository } from "../../ports/district-repository.js"
import type { SupportGroupRepository } from "../../ports/support.js"

export interface ShopSettingsPatch {
    name?: string
    brandColor?: string
    logoKey?: string | null
    /** «Muqova rasmi»: set by the upload route only; `null` removes it. */
    coverKey?: string | null
    /** «Vitrina qanday ko'rinadi»: one of `STOREFRONT_LAYOUTS`; never unset once chosen. */
    storefrontLayout?: string
    address?: string | null
    location?: LocationDTO | null
    /** The number customers call about an order; `null` or "" removes it. */
    contactPhone?: string | null
    delivery?: {
        fee: number
        freeFrom?: number | null
        minOrder?: number | null
        radiusMeters?: number | null
        /** The customer pays the carrier; left out: as it was. */
        customerPaysCarrier?: boolean
        /** The owner's choice of how delivery is paid; left out: the choice made before stays. */
        price?: DeliveryPriceChoice
    }
    /** `null` = always open. */
    workingHours?: WeeklySchedule | null
    acceptingOrders?: boolean
    /** Vertical toggles the owner switched on. */
    features?: string[]
    /** Deposit per kept returnable bottle, UZS (0 = only count bottles). */
    bottleDeposit?: number
    /** When its own couriers are busy, orders go to the district network. */
    networkDelivery?: boolean
    /** Which ways of paying the shop takes: card, cash or both. */
    paymentOptions?: string
    /**
     * «Raqamni mijozlarga ko'rsatmaslik». Turning it on needs the support group
     * (`SUPPORT_GROUP_REQUIRED`); turning it off, or sending it unchanged, never does.
     */
    phoneHidden?: boolean
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
        /** Whether the shop has a support group, read only to hide its number. */
        private readonly supportGroups?: Pick<SupportGroupRepository, "find">,
    ) {}

    async execute(input: UpdateShopInput): Promise<ShopOwnerDTO> {
        const business = await requireOwnedBusiness(
            this.businesses,
            input.businessId,
            input.actorTelegramId,
        )
        await this.requireGroupToHidePhone(business, input.patch)
        applyPatch(business, input.patch)
        if (input.patch.location !== undefined && this.districts) {
            business.setDistrict(await districtIdFor(this.districts, business.location))
        }
        await this.businesses.save(business)
        return toShopOwnerDTO(business, this.clock.now())
    }

    /**
     * A customer who cannot call must still reach the shop (owner's decision, November 2026):
     * the number is hidden only by a shop whose support group is connected. Checked only when
     * the switch goes on, so a form sent again as it was never fails on it.
     */
    private async requireGroupToHidePhone(
        business: Business,
        patch: ShopSettingsPatch,
    ): Promise<void> {
        if (patch.phoneHidden !== true || business.phoneHidden) {
            return
        }
        if (!this.supportGroups || !(await this.supportGroups.find(business.id))) {
            throw BusinessRuleViolationError.supportGroupRequired(business.id)
        }
    }
}

function applyPatch(business: Business, patch: ShopSettingsPatch): void {
    business.updateProfile(toProfilePatch(patch))
    if (patch.delivery) {
        business.updateDelivery(
            {
                fee: Money.of(patch.delivery.fee),
                freeFrom: Money.optional(patch.delivery.freeFrom),
                minOrder: Money.optional(patch.delivery.minOrder),
                radiusMeters: patch.delivery.radiusMeters ?? undefined,
                customerPaysCarrier:
                    patch.delivery.customerPaysCarrier ?? business.delivery.customerPaysCarrier,
            },
            patch.delivery.price,
        )
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
    if (patch.paymentOptions !== undefined) {
        business.setPaymentOptions(
            requireOneOf("paymentOptions", patch.paymentOptions, PAYMENT_OPTIONS),
        )
    }
    if (patch.storefrontLayout !== undefined) {
        business.setStorefrontLayout(
            requireOneOf("storefrontLayout", patch.storefrontLayout, STOREFRONT_LAYOUTS),
        )
    }
    if (patch.phoneHidden !== undefined) {
        business.setPhoneHidden(patch.phoneHidden)
    }
}

function toProfilePatch(patch: ShopSettingsPatch): ProfilePatch {
    const profile: ProfilePatch = {
        name: patch.name,
        logoKey: patch.logoKey,
        coverKey: patch.coverKey,
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
    if (patch.contactPhone !== undefined) {
        profile.contactPhone = patch.contactPhone?.trim() ? Phone.create(patch.contactPhone) : null
    }
    return profile
}
