import { requireInteger, requireText } from "../shared/guards.js"

import type { Unit } from "../enums/unit.js"
import type { Money } from "../value-objects/money.js"

export const MAX_ITEM_QUANTITY = 99

/** A line of an order. Name, unit and price are copied from the product when the order is placed. */
export class OrderItem {
    private constructor(
        public readonly productId: string,
        public readonly name: string,
        public readonly unit: Unit,
        public readonly unitPrice: Money,
        public readonly quantity: number,
    ) {}

    static create(input: {
        productId: string
        name: string
        unit: Unit
        unitPrice: Money
        quantity: number
    }): OrderItem {
        return new OrderItem(
            input.productId,
            requireText("name", input.name, 200),
            input.unit,
            input.unitPrice,
            requireInteger("quantity", input.quantity, 1, MAX_ITEM_QUANTITY),
        )
    }

    get total(): Money {
        return this.unitPrice.multiply(this.quantity)
    }
}
