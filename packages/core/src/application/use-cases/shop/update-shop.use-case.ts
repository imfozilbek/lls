import { BrandColor } from "../../../domain/value-objects/brand-color.js"
import { Location } from "../../../domain/value-objects/location.js"
import { Money } from "../../../domain/value-objects/money.js"
import { WorkingHours } from "../../../domain/value-objects/working-hours.js"
import { toShopOwnerDTO } from "../../dtos/shop.dto.js"
import { requireOwnedBusiness } from "../shared.js"

import { optionalMoney } from "./register-shop.use-case.js"

import type { Business, ProfilePatch } from "../../../domain/entities/business.js"
import type { WeeklySchedule } from "../../../domain/value-objects/working-hours.js"
import type { LocationDTO, ShopOwnerDTO } from "../../dtos/shop.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"

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
    ) {}

    async execute(input: UpdateShopInput): Promise<ShopOwnerDTO> {
        const business = await requireOwnedBusiness(
            this.businesses,
            input.businessId,
            input.actorTelegramId,
        )
        applyPatch(business, input.patch)
        await this.businesses.save(business)
        return toShopOwnerDTO(business, this.clock.now())
    }
}

function applyPatch(business: Business, patch: ShopSettingsPatch): void {
    business.updateProfile(toProfilePatch(patch))
    if (patch.delivery) {
        business.updateDelivery({
            fee: Money.of(patch.delivery.fee),
            freeFrom: optionalMoney(patch.delivery.freeFrom),
            minOrder: optionalMoney(patch.delivery.minOrder),
            radiusMeters: patch.delivery.radiusMeters ?? undefined,
        })
    }
    if (patch.workingHours !== undefined) {
        business.setWorkingHours(WorkingHours.fromJSON(patch.workingHours))
    }
    if (patch.acceptingOrders !== undefined) {
        business.setAcceptingOrders(patch.acceptingOrders)
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
