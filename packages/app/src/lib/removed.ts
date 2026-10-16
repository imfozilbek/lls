import { fill } from "../i18n/index.js"
import { removedNames } from "../stores/cart.js"

import type { Dictionary } from "../i18n/index.js"
import type { ProductDTO } from "@zumda/core"

/**
 * «"Lag'mon" endi yo'q…» by name when the catalog the customer saw knows it; else how many. A
 * product still on the menu lost only the pick in the cart (a size the owner removed): it says
 * «o'zgardi», never that the product is gone.
 */
export function removedText(
    t: Dictionary,
    ids: readonly string[],
    seen: readonly ProductDTO[],
    current: readonly ProductDTO[] = [],
): string {
    const onMenu = new Set(current.map((p) => p.id))
    const known = [...seen, ...current]
    const parts: string[] = []
    for (const [group, text] of [
        [ids.filter((id) => !onMenu.has(id)), t.cart.removedNamed],
        [ids.filter((id) => onMenu.has(id)), t.cart.changedNamed],
    ] as const) {
        if (group.length === 0) {
            continue
        }
        const names = removedNames(group, known)
        if (names.length !== group.length) {
            return fill(t.cart.removed, { n: ids.length })
        }
        parts.push(fill(text, { names: names.join(", ") }))
    }
    return parts.join(" ")
}
