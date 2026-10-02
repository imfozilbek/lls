import { OrderItem } from "../../../domain/entities/order-item.js"
import { MAX_ORDER_LINES, Order, subtotalOf } from "../../../domain/entities/order.js"
import { Feature } from "../../../domain/enums/feature.js"
import { OrderChannel } from "../../../domain/enums/order-channel.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { ConflictError } from "../../../domain/errors/conflict.error.js"
import { EntityNotFoundError } from "../../../domain/errors/not-found.error.js"
import { Location } from "../../../domain/value-objects/location.js"
import { TRUSTED_SCOPE, shopScope } from "../../dtos/identity-scope.js"
import { toOrderDTO } from "../../dtos/order.dto.js"
import { displayNameOf } from "../../dtos/telegram-user.js"
import { phoneVisibleIn, resolveCustomer } from "../customer/customer.use-cases.js"
import { requireBusiness } from "../shared.js"

import type { Product } from "../../../domain/entities/product.js"
import type { IdentityScope } from "../../dtos/identity-scope.js"
import type { OrderDTO } from "../../dtos/order.dto.js"
import type { LocationDTO } from "../../dtos/shop.dto.js"
import type { TelegramUser } from "../../dtos/telegram-user.js"
import type { BusinessRepository } from "../../ports/business-repository.js"
import type { Clock } from "../../ports/clock.js"
import type { CustomerRepository } from "../../ports/customer-repository.js"
import type { OrderRepository } from "../../ports/order-repository.js"
import type { ProductRepository } from "../../ports/product-repository.js"

const MAX_NUMBER_ATTEMPTS = 3

export interface OrderLineInput {
    productId: string
    quantity: number
}

export interface PlaceOrderInput {
    user: TelegramUser
    businessId: string
    /** Only ids and quantities. Names and prices always come from the database. */
    items: OrderLineInput[]
    address: string
    landmark?: string
    location?: LocationDTO
    comment?: string
    /** Empty returnable bottles the customer gives back (water shops). */
    bottlesReturned?: number
    /** Decided by the server from which bot opened the app; never sent by the client. */
    channel?: OrderChannel
}

export interface PlaceOrderDeps {
    businesses: BusinessRepository
    products: ProductRepository
    customers: CustomerRepository
    orders: OrderRepository
    clock: Clock
}

/** Same product twice → one line with the summed quantity. */
function mergeLines(lines: readonly OrderLineInput[]): OrderLineInput[] {
    const merged = new Map<string, number>()
    for (const line of lines) {
        merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.quantity)
    }
    return [...merged].map(([productId, quantity]) => ({ productId, quantity }))
}

interface PricedLines {
    items: OrderItem[]
    /** How many returnable bottles are ordered (they are counted in pieces). */
    returnable: number
}

function buildItems(lines: OrderLineInput[], products: Product[], now: Date): PricedLines {
    const byId = new Map(products.map((product) => [product.id, product]))
    let returnable = 0
    const items = lines.map((line) => {
        const product = byId.get(line.productId)
        if (!product) {
            throw EntityNotFoundError.product(line.productId)
        }
        if (!product.isAvailableAt(now)) {
            throw BusinessRuleViolationError.productNotAvailable(product.id)
        }
        product.assertQuantity(line.quantity)
        if (product.returnable) {
            returnable += line.quantity
        }
        return OrderItem.create({
            productId: product.id,
            name: product.name,
            unit: product.unit,
            category: product.category,
            unitPrice: product.price,
            quantity: line.quantity,
        })
    })
    return { items, returnable }
}

export class PlaceOrderUseCase {
    constructor(private readonly deps: PlaceOrderDeps) {}

    async execute(input: PlaceOrderInput): Promise<OrderDTO> {
        const { businesses, products, customers, orders, clock } = this.deps
        const now = clock.now()

        const business = await requireBusiness(businesses, input.businessId)
        business.assertCanAcceptOrders(now)

        const lines = mergeLines(input.items)
        if (lines.length === 0) {
            throw BusinessRuleViolationError.emptyOrder()
        }
        if (lines.length > MAX_ORDER_LINES) {
            throw BusinessRuleViolationError.tooManyItems(MAX_ORDER_LINES)
        }

        // Through the showcase the LLS bot signed the user; through a shop bot only that shop's
        // owner did, so the phone must have been sent to this very shop.
        const channel = input.channel ?? OrderChannel.SHOP_BOT
        const scope: IdentityScope =
            channel === OrderChannel.MARKETPLACE ? TRUSTED_SCOPE : shopScope(business.id)
        const customer = await resolveCustomer(customers, input.user, scope)
        if (!(await phoneVisibleIn(customers, customer, scope))) {
            throw BusinessRuleViolationError.phoneRequired()
        }

        const location = input.location
            ? Location.create(input.location.latitude, input.location.longitude)
            : undefined
        business.assertDeliversTo(location)

        const found = await products.findByIds(
            business.id,
            lines.map((line) => line.productId),
        )
        const { items, returnable } = buildItems(lines, found, now)
        const subtotal = subtotalOf(items)
        business.assertMinOrder(subtotal)

        const commissionBps = business.commissionBpsFor(channel)
        const bottlesReturned = business.hasFeature(Feature.BOTTLE_DEPOSIT)
            ? (input.bottlesReturned ?? 0)
            : 0
        const depositTotal = business.depositFor(returnable, bottlesReturned)

        for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS; attempt++) {
            const order = Order.place({
                id: crypto.randomUUID(),
                businessId: business.id,
                customerId: customer.id,
                number: await orders.nextNumber(business.id),
                channel,
                items,
                deliveryFee: business.deliveryFeeFor(subtotal),
                depositTotal,
                bottlesReturned,
                commissionBps,
                address: input.address,
                landmark: input.landmark,
                location,
                comment: input.comment,
                // The name as signed for this order: a shop-signed name never renames the customer.
                customerName: displayNameOf(input.user),
                customerPhone: customer.phone,
            })
            if (await orders.insert(order)) {
                await customers.linkToBusiness(customer.id, business.id, now)
                // Ordering through the showcase hands the phone to this shop.
                await customers.sharePhoneWith(customer.id, business.id, now)
                return toOrderDTO(order)
            }
        }
        throw new ConflictError("Could not assign an order number, please try again")
    }
}
