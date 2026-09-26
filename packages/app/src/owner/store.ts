import { create } from "zustand"

import { api } from "../lib/api.js"
import { useSession } from "../stores/session.js"

import type { ProductDTO } from "@lls/core"

export type OwnerTab = "orders" | "menu" | "stats" | "settings"

interface OwnerState {
    tab: OwnerTab
    /** All products, hidden ones too. `null` until the first load. */
    products: ProductDTO[] | null
    setTab(tab: OwnerTab): void
    loadProducts(): Promise<void>
    upsert(product: ProductDTO): void
    drop(id: string): void
}

/** The storefront must show the owner's edits right away. */
function refreshStorefront(): void {
    api.products()
        .then((page) => useSession.getState().setCatalog(page.data))
        .catch(() => undefined)
}

export const useOwner = create<OwnerState>((set, get) => ({
    tab: "orders",
    products: null,
    setTab: (tab): void => set({ tab }),
    loadProducts: async (): Promise<void> => {
        set({ products: (await api.owner.products()).data })
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
