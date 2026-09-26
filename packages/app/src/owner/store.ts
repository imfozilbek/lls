import { create } from "zustand"

import { api, loadCatalog, loadOwnerProducts } from "../lib/api.js"
import { useSession } from "../stores/session.js"

import type { CourierDTO, ProductDTO } from "@lls/core"

export type OwnerTab = "orders" | "menu" | "stats" | "settings"

interface OwnerState {
    tab: OwnerTab
    /** All products, hidden ones too. `null` until the first load. */
    products: ProductDTO[] | null
    /** Active couriers of the shop. `null` until the first load. */
    couriers: CourierDTO[] | null
    setTab(tab: OwnerTab): void
    loadCouriers(): Promise<void>
    loadProducts(): Promise<void>
    upsert(product: ProductDTO): void
    drop(id: string): void
}

/** The storefront must show the owner's edits right away. */
function refreshStorefront(): void {
    loadCatalog()
        .then((products) => useSession.getState().setCatalog(products))
        .catch(() => undefined)
}

export const useOwner = create<OwnerState>((set, get) => ({
    tab: "orders",
    products: null,
    couriers: null,
    setTab: (tab): void => set({ tab }),
    loadCouriers: async (): Promise<void> => {
        set({ couriers: await api.owner.couriers() })
    },
    loadProducts: async (): Promise<void> => {
        set({ products: await loadOwnerProducts() })
    },
    upsert: (product): void => {
        const list = get().products ?? []
        const exists = list.some((p) => p.id === product.id)
        set({
            products: exists
                ? list.map((p) => (p.id === product.id ? product : p))
                : [...list, product],
        })
        refreshStorefront()
    },
    drop: (id): void => {
        set({ products: (get().products ?? []).filter((p) => p.id !== id) })
        refreshStorefront()
    },
}))
