import { Feature, isFinalStatus } from "@lls/core"

import { fill, useT } from "../i18n/index.js"
import { haptic } from "../lib/telegram.js"
import { useCart } from "../stores/cart.js"
import { useRouter } from "../stores/router.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"

import type { OrderDTO } from "@lls/core"

/**
 * "Order again": the same items at today's prices go to the cart; missing ones are skipped
 * with a note. `null` when the shop has no reorder or the order is still running.
 */
export function useReorder(order: OrderDTO): (() => void) | null {
    const t = useT()
    const reset = useRouter((state) => state.reset)
    const catalog = useSession((state) => state.catalog)
    const enabled = useSession((state) => state.shop?.features.includes(Feature.REORDER) ?? false)
    if (!enabled || !isFinalStatus(order.status)) {
        return null
    }
    return (): void => {
        haptic.tap()
        const skipped = useCart.getState().refill(order.items, catalog)
        if (skipped > 0) {
            toast(fill(t.order.reorderSkipped, { n: skipped }))
        }
        reset({ name: "cart" })
    }
}
