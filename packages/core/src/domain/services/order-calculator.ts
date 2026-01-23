import { Money } from "../value-objects/money.js"

export interface OrderItemInput {
    price: Money
    quantity: number
}

export interface OrderCalculationResult {
    subtotal: Money
    deliveryFee: Money
    total: Money
    itemCount: number
}

const DEFAULT_DELIVERY_FEE = 15000 // 15,000 UZS
const FREE_DELIVERY_THRESHOLD = 100000 // Free delivery for orders over 100,000 UZS

/**
 * Calculate order totals
 */
export function calculateOrderTotal(
    items: OrderItemInput[],
    deliveryFee: number = DEFAULT_DELIVERY_FEE,
    freeDeliveryThreshold: number = FREE_DELIVERY_THRESHOLD,
): OrderCalculationResult {
    if (items.length === 0) {
        const zero = Money.create(0, "UZS")
        return {
            subtotal: zero,
            deliveryFee: zero,
            total: zero,
            itemCount: 0,
        }
    }

    const currency = items[0]?.price.currency ?? "UZS"

    // Calculate subtotal
    let subtotalAmount = 0
    let itemCount = 0

    for (const item of items) {
        subtotalAmount += item.price.amount * item.quantity
        itemCount += item.quantity
    }

    const subtotal = Money.create(subtotalAmount, currency)

    // Calculate delivery fee (free if above threshold)
    const deliveryFeeAmount = subtotalAmount >= freeDeliveryThreshold ? 0 : deliveryFee
    const deliveryFeeMoney = Money.create(deliveryFeeAmount, currency)

    // Calculate total
    const total = subtotal.add(deliveryFeeMoney)

    return {
        subtotal,
        deliveryFee: deliveryFeeMoney,
        total,
        itemCount,
    }
}

/**
 * Calculate discount amount
 */
export function calculateDiscount(subtotal: Money, discountPercent: number): Money {
    if (discountPercent <= 0 || discountPercent > 100) {
        return Money.create(0, subtotal.currency)
    }

    const discountAmount = Math.round(subtotal.amount * (discountPercent / 100))
    return Money.create(discountAmount, subtotal.currency)
}

/**
 * Apply discount to order
 */
export function applyDiscount(
    calculation: OrderCalculationResult,
    discountPercent: number,
): OrderCalculationResult & { discount: Money } {
    const discount = calculateDiscount(calculation.subtotal, discountPercent)
    const newSubtotal = Money.create(
        Math.max(0, calculation.subtotal.amount - discount.amount),
        calculation.subtotal.currency,
    )
    const newTotal = newSubtotal.add(calculation.deliveryFee)

    return {
        ...calculation,
        subtotal: newSubtotal,
        total: newTotal,
        discount,
    }
}

/**
 * Format order summary for display
 */
export function formatOrderSummary(calculation: OrderCalculationResult): string {
    const lines = [
        `Subtotal: ${calculation.subtotal.format()}`,
        `Delivery: ${calculation.deliveryFee.amount === 0 ? "Free" : calculation.deliveryFee.format()}`,
        `Total: ${calculation.total.format()}`,
        `Items: ${calculation.itemCount}`,
    ]
    return lines.join("\n")
}
