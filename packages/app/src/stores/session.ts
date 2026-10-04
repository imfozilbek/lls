import { create } from "zustand"

import type { CustomerDTO, ProductDTO, ShopPublicDTO } from "@zumda/core"

/** The viewer's role in this shop, decided by the server from verified Telegram data. */
export type ViewerRole = "owner" | "customer"

export type Shop = ShopPublicDTO & { viewerRole: ViewerRole }

interface SessionState {
    shop: Shop | null
    me: CustomerDTO | null
    catalog: ProductDTO[]
    /** A product tapped in the showcase: its shop opens on it, once. */
    focusProductId: string | null
    focusProduct(id: string | null): void
    setShop(shop: Shop): void
    setMe(me: CustomerDTO): void
    setCatalog(catalog: ProductDTO[]): void
}

export const useSession = create<SessionState>((set) => ({
    shop: null,
    me: null,
    catalog: [],
    focusProductId: null,
    focusProduct: (id): void => set({ focusProductId: id }),
    setShop: (shop): void => set({ shop }),
    setMe: (me): void => set({ me }),
    setCatalog: (catalog): void => set({ catalog }),
}))
