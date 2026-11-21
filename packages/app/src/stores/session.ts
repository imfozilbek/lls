import { create } from "zustand"

import type { CustomerDTO, ProductDTO, ShopPublicDTO } from "@zumda/core"

/** The viewer's role in this shop, decided by the server from verified Telegram data. */
export type ViewerRole = "owner" | "customer"

/** `networkDelivery`: the owner's only («Tuman tarmog'idan foydalanish»), never a customer's. */
export type Shop = ShopPublicDTO & { viewerRole: ViewerRole; networkDelivery?: boolean }

interface SessionState {
    shop: Shop | null
    me: CustomerDTO | null
    catalog: ProductDTO[]
    /** A product tapped in the showcase: its shop opens on it, once. */
    focusProductId: string | null
    /** A channel post or an ad link: the product opens up close too, not only in view. */
    focusOpen: boolean
    focusProduct(id: string | null, open?: boolean): void
    setShop(shop: Shop): void
    setMe(me: CustomerDTO): void
    setCatalog(catalog: ProductDTO[]): void
}

export const useSession = create<SessionState>((set) => ({
    shop: null,
    me: null,
    catalog: [],
    focusProductId: null,
    focusOpen: false,
    focusProduct: (id, open = false): void => set({ focusProductId: id, focusOpen: open }),
    setShop: (shop): void => set({ shop }),
    setMe: (me): void => set({ me }),
    setCatalog: (catalog): void => set({ catalog }),
}))
