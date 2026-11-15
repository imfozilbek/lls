import { OrderStatus } from "@zumda/core"

import type { OrderDTO } from "@zumda/core"

/**
 * Where an active order stands for the owner, the chips over «Faol»: new (the money or the
 * acceptance), in work, ready, on the way. A finished order has no stage.
 */
export type OrderStage = "new" | "work" | "ready" | "road"

export const STAGES: readonly OrderStage[] = ["new", "work", "ready", "road"]

const BY_STATUS: Partial<Record<OrderStatus, OrderStage>> = {
    [OrderStatus.PENDING]: "new",
    [OrderStatus.ACCEPTED]: "work",
    [OrderStatus.PREPARING]: "work",
    [OrderStatus.READY]: "ready",
    [OrderStatus.PICKED_UP]: "road",
}

export function stageOf(order: OrderDTO): OrderStage | null {
    return BY_STATUS[order.status] ?? null
}

/** How many orders each stage has: a chip shows only a stage with orders. */
export function stageCounts(orders: readonly OrderDTO[]): Record<OrderStage, number> {
    const counts: Record<OrderStage, number> = { new: 0, work: 0, ready: 0, road: 0 }
    for (const order of orders) {
        const stage = stageOf(order)
        if (stage) {
            counts[stage] += 1
        }
    }
    return counts
}

/** The chips worth showing: two stages or more with orders, else the list is short anyway. */
export function shownStages(counts: Record<OrderStage, number>): OrderStage[] {
    const used = STAGES.filter((stage) => counts[stage] > 0)
    return used.length > 1 ? used : []
}
