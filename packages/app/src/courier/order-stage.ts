import { CourierStatus, OrderStatus } from "@zumda/core"

import type { Dictionary } from "../i18n/index.js"
import type { CourierHomeDTO, OrderDTO } from "@zumda/core"

/** On the way first, then ready to pick up, then the ones still being made. */
export function stageRank(order: Pick<OrderDTO, "status">): number {
    if (order.status === OrderStatus.PICKED_UP) {
        return 0
    }
    return order.status === OrderStatus.READY ? 1 : 2
}

/** Why nothing comes: off shift, not approved yet, a day off everywhere; else the usual word. */
export function emptyReason(
    t: Dictionary,
    home: Pick<CourierHomeDTO, "profile" | "shops">,
): string {
    if (!home.profile.onShift) {
        return t.courier.emptyOffShift
    }
    const own = home.shops.filter((shop) => shop.status !== CourierStatus.NETWORK)
    if (own.length > 0 && own.every((shop) => shop.status === CourierStatus.PENDING)) {
        return t.courier.emptyWaiting
    }
    if (own.length > 0 && own.every((shop) => !shop.worksToday)) {
        return t.courier.emptyDayOff
    }
    return t.courier.emptyText
}
