import { OwnerChat } from "@zumda/core"

import type { PlatformShopDTO } from "@zumda/core"

/**
 * «Bizneslar» chips (owner's decision, November 2026: every shop open in one long list hid what
 * needs the team): in the showcase, demos, without a phone, a bot that cannot write its owner.
 */
export type ShopFilter = "all" | "showcase" | "demo" | "noPhone" | "chatClosed"

export const SHOP_FILTERS: readonly ShopFilter[] = [
    "all",
    "showcase",
    "demo",
    "noPhone",
    "chatClosed",
]

/** No number to call the shop on: neither its own nor the owner's (a demo needs none). */
export function lacksPhone(shop: PlatformShopDTO): boolean {
    return !shop.demo && !shop.contactPhone && !shop.owner.phone
}

export function inShopFilter(shop: PlatformShopDTO, filter: ShopFilter): boolean {
    switch (filter) {
        case "showcase":
            return shop.marketplace !== undefined
        case "demo":
            return shop.demo
        case "noPhone":
            return lacksPhone(shop)
        case "chatClosed":
            return shop.ownerChat === OwnerChat.CLOSED
        default:
            return true
    }
}

export function shopFilterCounts(shops: readonly PlatformShopDTO[]): Record<ShopFilter, number> {
    const counts = { all: 0, showcase: 0, demo: 0, noPhone: 0, chatClosed: 0 }
    for (const filter of SHOP_FILTERS) {
        counts[filter] = shops.filter((shop) => inShopFilter(shop, filter)).length
    }
    return counts
}

/** «Hammasi» and every chip with shops, once there is anything to tell apart. */
export function shownShopFilters(counts: Record<ShopFilter, number>): ShopFilter[] {
    const used = SHOP_FILTERS.filter((filter) => filter === "all" || counts[filter] > 0)
    return used.length > 1 ? used : []
}
