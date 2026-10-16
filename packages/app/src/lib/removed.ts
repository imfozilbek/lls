import { fill } from "../i18n/index.js"
import { removedNames } from "../stores/cart.js"

import type { Dictionary } from "../i18n/index.js"
import type { ProductDTO } from "@zumda/core"

/** «"Lag'mon" endi yo'q…» by name when the catalog the customer saw knows it; else how many. */
export function removedText(
    t: Dictionary,
    ids: readonly string[],
    seen: readonly ProductDTO[],
): string {
    const names = removedNames(ids, seen)
    return names.length === ids.length
        ? fill(t.cart.removedNamed, { names: names.join(", ") })
        : fill(t.cart.removed, { n: ids.length })
}
