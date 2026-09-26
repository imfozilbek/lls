import { create } from "zustand"

import type { CustomerDTO, ProductDTO, ShopPublicDTO } from "@lls/core"

export type Shop = ShopPublicDTO & { viewerIsOwner: boolean }

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
