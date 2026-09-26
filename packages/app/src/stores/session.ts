import { create } from "zustand"

import type { CustomerDTO, ProductDTO, ShopPublicDTO } from "@lls/core"

/** The viewer's role in this shop, decided by the server from verified Telegram data. */
export type ViewerRole = "owner" | "courier" | "customer"

export type Shop = ShopPublicDTO & { viewerRole: ViewerRole }

interface SessionState {
    shop: Shop | null
    me: CustomerDTO | null
    catalog: ProductDTO[]
    setShop(shop: Shop): void
    setMe(me: CustomerDTO): void
    setCatalog(catalog: ProductDTO[]): void
}

export const useSession = create<SessionState>((set) => ({
    shop: null,
    me: null,
    catalog: [],
    setShop: (shop): void => set({ shop }),
    setMe: (me): void => set({ me }),
    setCatalog: (catalog): void => set({ catalog }),
}))
