import { packagesOf } from "../../../domain/enums/unit.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { toOrderDTO } from "../../dtos/order.dto.js"
import { requireOwnedBusiness } from "../shared.js"

import type { Business } from "../../../domain/entities/business.js"
import type { OrderItem } from "../../../domain/entities/order-item.js"
import type { Order } from "../../../domain/entities/order.js"
import type { Money } from "../../../domain/value-objects/money.js"
import type { OrderDTO } from "../../dtos/order.dto.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { OrderRepository } from "../../ports/order-repository.js"
import type { ProductRepository } from "../../ports/product-repository.js"

export interface RemoveOrderLineDeps {
    businesses: BusinessRepository
    orders: OrderRepository
    products: ProductRepository
    clock: Clock
}

export interface RemoveOrderLineInput {
    actorTelegramId: number
    businessId: string
    orderId: string
    line: number
    /** «Bugun boshqa sotilmasin»: the product is off the shelf until midnight, its count is 0. */
    stopToday: boolean
}

/** The order as it is now, and the line that was taken out (for the customer's message). */
export interface RemovedLine {
    order: OrderDTO
    removed: { name: string; quantity: number; unit: OrderItem["unit"] }
}

/**
 * «Yo'q» (owner's decision, November 2026): a line the shop does not have leaves the order before
 * «Tayyor». The sum goes down; a paid transfer owes the difference back; the delivery fee stays.
 */
export class RemoveOrderLineUseCase {
    constructor(private readonly deps: RemoveOrderLineDeps) {}

    async execute(input: RemoveOrderLineInput): Promise<RemovedLine> {
        const business = await requireOwnedBusiness(
            this.deps.businesses,
            input.businessId,
            input.actorTelegramId,
        )
        const order = await this.deps.orders.findById(input.orderId)
        if (!order || order.businessId !== input.businessId) {
            throw EntityNotFoundError.order(input.orderId)
        }
        const now = this.deps.clock.now()
        const depositAfter = await this.depositWithout(order, business, input.line)
        const removed = order.removeLine(input.line, now, depositAfter)
        await this.deps.orders.save(order)
        if (input.stopToday) {
            await this.stopToday(business.id, removed.productId, now)
        }
        return {
            order: toOrderDTO(order),
            removed: { name: removed.name, quantity: removed.quantity, unit: removed.unit },
        }
    }

    /** The bottle deposit the order's other lines need: empty bottles still count as returned. */
    private async depositWithout(order: Order, business: Business, line: number): Promise<Money> {
        const rest = order.lines().filter((l) => l.line !== line && !l.item.removedAt)
        const products = await this.deps.products.findByIds(
            business.id,
            rest.map(({ item }) => item.productId),
        )
        const returnableIds = new Set(products.filter((p) => p.returnable).map((p) => p.id))
        const returnable = rest
            .filter(({ item }) => returnableIds.has(item.productId))
            .reduce((sum, { item }) => sum + packagesOf(item.unit, item.quantity), 0)
        return business.depositFor(returnable, order.bottlesReturned)
    }

    /** Off the shelf until midnight; a counted product has nothing left. */
    private async stopToday(businessId: string, productId: string, now: Date): Promise<void> {
        const product = await this.deps.products.findById(productId)
        if (!product || product.businessId !== businessId) {
            return
        }
        product.stopForToday(now)
        if (product.tracksStock) {
            product.update({ stock: 0 })
        }
        await this.deps.products.save(product)
    }
}
