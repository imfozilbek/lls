import { Feature, isFinalStatus } from "@zumda/core"

import { fill, useT } from "../i18n/index.js"
import { confirm, haptic } from "../lib/telegram.js"
import { pickPrice, useCart } from "../stores/cart.js"
import { useRouter } from "../stores/router.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"

import type { OrderDTO, ProductDTO } from "@zumda/core"

/** How many of the order's lines the shop sells today, as `refill` would put them back. */
function onSaleCount(order: OrderDTO, catalog: readonly ProductDTO[]): number {
    const onSale = new Map(catalog.filter((p) => p.isAvailable).map((p) => [p.id, p]))
    return order.items.filter((item) => {
        const product = onSale.get(item.productId)
        const pick = item.options
            ? { variantId: item.options.variantId, addonIds: item.options.addonIds }
            : undefined
        return product !== undefined && pickPrice(product, pick) !== null
    }).length
}

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
        void (async (): Promise<void> => {
            // Nothing of it is sold today: the cart is left as it is, never emptied for nothing.
            if (onSaleCount(order, catalog) === 0) {
                toast(t.order.reorderNone, "error")
                return
            }
            const cart = useCart.getState()
            // What the customer already put in stays unless they say otherwise: closing the
            // question keeps both.
            if (Object.keys(cart.lines).length > 0) {
                const only = await confirm(t.order.reorderKeep, {
                    yes: t.order.reorderOnly,
                    no: t.order.reorderBoth,
                })
                if (only) {
                    cart.clear()
                }
            }
            const skipped = useCart.getState().refill(order.items, catalog)
            if (skipped > 0) {
                toast(fill(t.order.reorderSkipped, { n: skipped }))
            }
            reset({ name: "cart" })
        })()
    }
}
