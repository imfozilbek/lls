import { CourierProfile } from "../../../domain/entities/courier-profile.js"
import { Courier } from "../../../domain/entities/courier.js"
import { PayoutCardBook } from "../../../domain/entities/payout-card-book.js"
import { Product } from "../../../domain/entities/product.js"
import { BusinessType } from "../../../domain/enums/business-type.js"
import { Feature } from "../../../domain/enums/feature.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { ForbiddenError } from "../../../domain/errors/forbidden.error.js"
import { Money } from "../../../domain/value-objects/money.js"
import { PayoutCard } from "../../../domain/value-objects/payout-card.js"
import { TelegramId } from "../../../domain/value-objects/telegram-id.js"
import { DEMO_CARD, demoTemplate } from "../../demo/demo-templates.js"
import { toShopOwnerDTO } from "../../dtos/shop.dto.js"
import { requireBusiness } from "../shared.js"

import type { Business } from "../../../domain/entities/business.js"
import type { DemoTemplate, DemoTemplateKey } from "../../demo/demo-templates.js"
import type { ShopOwnerDTO } from "../../dtos/shop.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { CourierRepository } from "../../ports/courier-repository.js"
import type { OrderRepository } from "../../ports/order-repository.js"
import type { PayoutCardRepository } from "../../ports/payout-card-repository.js"
import type { ProductRepository } from "../../ports/product-repository.js"

export interface DemoShopDeps {
    businesses: BusinessRepository
    products: ProductRepository
    cards: PayoutCardRepository
    couriers: CourierRepository
    orders: OrderRepository
    clock: Clock
    platformAdminIds: readonly number[]
}

/** The owner as the demo's courier, until they set a name of their own in the courier bot. */
const DEMO_COURIER_NAME = "Namuna kuryer"

/** The same name as people read it: no case, no apostrophe, one space. */
function sameName(name: string): string {
    return name
        .toLowerCase()
        .replace(/['ʻʼ‘’`]/g, "")
        .replace(/\s+/g, " ")
        .trim()
}

function productsOf(template: DemoTemplate, businessId: string, skip: Set<string>): Product[] {
    return template.products
        .filter((item) => !skip.has(sameName(item.name)))
        .map((item, position) =>
            Product.create({ ...item, position, id: crypto.randomUUID(), businessId }),
        )
}

async function requireAdmin(deps: DemoShopDeps, actorTelegramId: number): Promise<void> {
    if (!deps.platformAdminIds.includes(actorTelegramId)) {
        throw ForbiddenError.notPlatformAdmin()
    }
}

/** The sample's kind of shop, its features and bottle deposit. */
function applyTemplate(business: Business, template: DemoTemplate): void {
    if (business.type !== template.type) {
        throw BusinessRuleViolationError.demoTemplateMismatch(template.key, business.type)
    }
    business.setFeatures(template.features)
    business.setBottleDeposit(Money.of(template.bottleDeposit))
}

/**
 * The test card is the one customers are shown: added (the shop and the card in one write) or,
 * if the shop has it already, chosen again.
 */
async function useTestCard(deps: DemoShopDeps, business: Business): Promise<void> {
    const book = new PayoutCardBook(business, await deps.cards.listByBusiness(business.id))
    const test = book.list().find((saved) => saved.card.number === DEMO_CARD.number)
    if (test) {
        book.choose(test.id)
        await deps.businesses.save(business)
        return
    }
    const saved = book.add({
        id: crypto.randomUUID(),
        card: PayoutCard.create(DEMO_CARD.number, DEMO_CARD.holder),
        now: deps.clock.now(),
    })
    book.choose(saved.id)
    await deps.businesses.saveWithCard(business, saved)
}

/** The owner delivers the demo's orders themselves: an approved courier of the shop. */
async function ownerAsCourier(deps: DemoShopDeps, business: Business): Promise<void> {
    const telegramId = business.ownerTelegramId.value
    const now = deps.clock.now()
    const link = await deps.couriers.findByTelegramId(business.id, telegramId)
    if (link && !link.isPending) {
        return
    }
    const profile =
        (await deps.couriers.findProfile(telegramId)) ??
        CourierProfile.create({
            telegramId: TelegramId.create(telegramId),
            name: DEMO_COURIER_NAME,
            now,
        })
    const courier =
        link ?? Courier.join({ id: crypto.randomUUID(), businessId: business.id, profile, now })
    courier.approve(now)
    await deps.couriers.saveProfile(profile)
    await deps.couriers.save(courier)
}

export interface MakeDemoShopInput {
    actorTelegramId: number
    businessId: string
    template: DemoTemplateKey
    /** The sample's logo, already stored: used only when the shop has none of its own. */
    logoKey?: string
}

/**
 * «Namuna qilish» in «Platforma»: a live shop becomes a demo filled from a sample of its kind
 * (catalog, test card, hours the whole day, the owner as its courier). Out of the showcase and
 * the district network for good. Products the shop has already are kept, never doubled.
 */
export class MakeDemoShopUseCase {
    constructor(private readonly deps: DemoShopDeps) {}

    async execute(input: MakeDemoShopInput): Promise<ShopOwnerDTO> {
        await requireAdmin(this.deps, input.actorTelegramId)
        const business = await requireBusiness(this.deps.businesses, input.businessId)
        const template = demoTemplate(input.template)
        applyTemplate(business, template)
        if (input.logoKey && !business.logoKey) {
            business.updateProfile({ logoKey: input.logoKey })
        }
        business.makeDemo(this.deps.clock.now())
        await useTestCard(this.deps, business)
        const taken = new Set((await this.deps.products.namesOf(business.id)).map(sameName))
        const fresh = productsOf(template, business.id, taken)
        if (fresh.length > 0) {
            await this.deps.products.saveMany(fresh)
        }
        await ownerAsCourier(this.deps, business)
        return toShopOwnerDTO(business, this.deps.clock.now())
    }
}

export interface ResetDemoShopInput {
    actorTelegramId: number
    businessId: string
}

/** The sample a demo was made from: its kind, and water for a grocery store with bottles. */
export function demoTemplateOf(business: Business): DemoTemplateKey {
    switch (business.type) {
        case BusinessType.FOOD:
            return "food"
        case BusinessType.SERVICE:
            return "service"
        case BusinessType.STORE:
            return "store"
        case BusinessType.GROCERY:
            return business.hasFeature(Feature.BOTTLE_DEPOSIT) ? "water" : "grocery"
    }
}

/**
 * «Namunani tozalash»: the demo starts again. Its orders are gone, its catalog is the sample's
 * again, its hours, card and switches are set back. Only a demo shop is ever reset.
 */
export class ResetDemoShopUseCase {
    constructor(private readonly deps: DemoShopDeps) {}

    async execute(input: ResetDemoShopInput): Promise<ShopOwnerDTO> {
        await requireAdmin(this.deps, input.actorTelegramId)
        const business = await requireBusiness(this.deps.businesses, input.businessId)
        if (!business.isDemo()) {
            throw BusinessRuleViolationError.notADemo(business.id)
        }
        const template = demoTemplate(demoTemplateOf(business))
        applyTemplate(business, template)
        business.makeDemo(this.deps.clock.now())
        await this.deps.orders.deleteAllOfBusiness(business.id)
        await this.deps.products.replaceAll(
            business.id,
            productsOf(template, business.id, new Set()),
        )
        await useTestCard(this.deps, business)
        await ownerAsCourier(this.deps, business)
        return toShopOwnerDTO(business, this.deps.clock.now())
    }
}
