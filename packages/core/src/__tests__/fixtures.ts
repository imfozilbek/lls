import { Business } from "../domain/entities/business.js"
import { Courier } from "../domain/entities/courier.js"
import { CourierProfile } from "../domain/entities/courier-profile.js"
import { Customer } from "../domain/entities/customer.js"
import { Product } from "../domain/entities/product.js"
import { BusinessType } from "../domain/enums/business-type.js"
import { Language } from "../domain/enums/language.js"
import { Unit } from "../domain/enums/unit.js"
import { Money } from "../domain/value-objects/money.js"
import { PayoutCard } from "../domain/value-objects/payout-card.js"
import { Phone } from "../domain/value-objects/phone.js"
import { Slug } from "../domain/value-objects/slug.js"
import { TelegramId } from "../domain/value-objects/telegram-id.js"

import type { DeliverySettings } from "../domain/entities/business.js"

export const OWNER_TG = 1001
export const CUSTOMER_TG = 2002
export const STRANGER_TG = 3003

/** The shop's card for transfers in tests (a valid Luhn number). secret-scan: fake */
export const TEST_CARD = { number: "4111111111111111", holder: "Rustam Karimov" }

/** An active shop with a card: it takes orders. `card: false` — a shop that has not added one. */
export function makeBusiness(
    overrides: { id?: string; delivery?: DeliverySettings; active?: boolean; card?: boolean } = {},
): Business {
    const business = Business.register({
        id: overrides.id ?? "biz-1",
        slug: Slug.create("osh-markaz"),
        name: "Osh Markaz",
        type: BusinessType.FOOD,
        ownerTelegramId: TelegramId.create(OWNER_TG),
        bot: { id: 777, username: "osh_markaz_bot" },
        delivery: overrides.delivery ?? { fee: Money.of(10_000) },
    })
    if (overrides.active ?? true) {
        business.approve()
    }
    if (overrides.card ?? true) {
        business.setPayoutCard(PayoutCard.create(TEST_CARD.number, TEST_CARD.holder))
    }
    return business
}

export function makeProduct(
    overrides: { id?: string; businessId?: string; price?: number; name?: string } = {},
): Product {
    return Product.create({
        id: overrides.id ?? "prod-1",
        businessId: overrides.businessId ?? "biz-1",
        name: overrides.name ?? "Osh",
        price: overrides.price ?? 35_000,
        unit: Unit.PORTION,
        category: "meals",
    })
}

export function makeCustomer(overrides: { id?: string; withPhone?: boolean } = {}): Customer {
    const customer = Customer.register({
        id: overrides.id ?? "cust-1",
        telegramId: TelegramId.create(CUSTOMER_TG),
        name: "Aziz",
        language: Language.UZ,
    })
    if (overrides.withPhone ?? true) {
        customer.setPhone(Phone.create("+998901234567"))
    }
    return customer
}

/** Monday 2026-09-28 12:00 in Tashkent (UTC+5). */
export const NOON_MONDAY_UZ = new Date("2026-09-28T07:00:00Z")

/** An approved courier of the shop, on shift today: ready for an order. */
export function makeCourier(
    overrides: { id?: string; businessId?: string; telegramId?: number; now?: Date } = {},
): Courier {
    const now = overrides.now ?? new Date()
    const profile = CourierProfile.create({
        telegramId: TelegramId.create(overrides.telegramId ?? 5005),
        name: "Jasur",
        now,
    })
    profile.startShift(now)
    const courier = Courier.join({
        id: overrides.id ?? "courier-1",
        businessId: overrides.businessId ?? "biz-1",
        profile,
        now,
    })
    courier.approve(now)
    return courier
}
