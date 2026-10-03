import { create } from "zustand"

import { api, loadCatalog, loadOwnerProducts } from "../lib/api.js"
import { useSession } from "../stores/session.js"

import type { CourierDTO, ProductDTO } from "@zumda/core"

export type OwnerTab = "orders" | "menu" | "money" | "settings"

/** The places in «Sozlamalar» that «Ishga tayyor» leads to. */
export type ReadySection = "card" | "location" | "hours" | "logo" | "courier"

interface OwnerState {
    tab: OwnerTab
    /** The order a bot message opened: shown first in «Buyurtmalar» until put away. */
    focusOrderId: string | null
    /** «Ishga tayyor» asked for this part of «Sozlamalar»: scroll to it once. */
    focusSection: ReadySection | null
    /** All products, hidden ones too. `null` until the first load. */
    products: ProductDTO[] | null
    /** The shop's couriers, waiting for approval first. `null` until the first load. */
    couriers: CourierDTO[] | null
    setTab(tab: OwnerTab): void
    focusOrder(id: string | null): void
    goToSection(section: ReadySection | null): void
    loadCouriers(): Promise<void>
    /** One courier changed (days, "not today"): swap it in place. */
    replaceCourier(courier: CourierDTO): void
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
    focusOrderId: null,
    focusSection: null,
    products: null,
    couriers: null,
    setTab: (tab): void => set({ tab }),
    focusOrder: (id): void => set({ focusOrderId: id, tab: "orders" }),
    goToSection: (section): void =>
        set(section ? { focusSection: section, tab: "settings" } : { focusSection: null }),
    loadCouriers: async (): Promise<void> => {
        set({ couriers: await api.owner.couriers() })
    },
    replaceCourier: (courier): void => {
        set({ couriers: (get().couriers ?? []).map((c) => (c.id === courier.id ? courier : c)) })
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
