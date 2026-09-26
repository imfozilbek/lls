import { unitScale } from "../enums/unit.js"
import { requireInteger, requireText } from "../shared/guards.js"

import type { Category } from "../enums/category.js"
import type { Unit } from "../enums/unit.js"
import type { Money } from "../value-objects/money.js"

/** Upper bound for any line: 99 × the largest weight step. The product checks its own step. */
const MAX_BASE_QUANTITY = 1_000_000

export interface OrderItemProps {
    productId: string
    name: string
    unit: Unit
    category: Category
    /** Price per unit: per piece, or per kilogram for `kg`. */
    unitPrice: Money
    /** Base units: pieces, or grams for `kg`. */
    quantity: number
}

/**
 * A line of an order. Name, unit, category and price are copied from the product when the order
 * is placed, so later catalog edits never change a past order (or a future commission report).
 */
export class OrderItem {
    readonly productId: string
    readonly name: string
    readonly unit: Unit
    readonly category: Category
    readonly unitPrice: Money
    readonly quantity: number

    private constructor(props: OrderItemProps) {
        this.productId = props.productId
        this.name = props.name
        this.unit = props.unit
        this.category = props.category
        this.unitPrice = props.unitPrice
        this.quantity = props.quantity
    }

    static create(input: OrderItemProps): OrderItem {
        return new OrderItem({
            ...input,
            name: requireText("name", input.name, 200),
            quantity: requireInteger("quantity", input.quantity, 1, MAX_BASE_QUANTITY),
        })
    }

    /** 12 000 so'm/kg × 1500 g = 18 000 so'm. Pieces multiply as they are. */
    get total(): Money {
        return this.unitPrice.multiplyRatio(this.quantity, unitScale(this.unit))
    }
}
