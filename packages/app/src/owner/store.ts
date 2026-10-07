import { create } from "zustand"

import { api, loadCatalog, loadOwnerProducts } from "../lib/api.js"
import { useSession } from "../stores/session.js"

import type { CourierDTO, ProductDTO } from "@zumda/core"

export type OwnerTab = "orders" | "menu" | "money" | "settings"

/** The places in «Sozlamalar» that «Ishga tayyor» leads to. */
export type ReadySection = "card" | "phone" | "location" | "hours" | "logo" | "courier"

interface OwnerState {
    /** The business this state belongs to: «Mening bizneslarim» switches between several. */
    shopId: string | null
    tab: OwnerTab
    /** The order a bot message opened: shown first in «Buyurtmalar» until put away. */
    focusOrderId: string | null
    /** «Ishga tayyor» asked for this part of «Sozlamalar»: scroll to it once. */
    focusSection: ReadySection | null
    /** All products, hidden ones too. `null` until the first load. */
    products: ProductDTO[] | null
    /** The shop's couriers, waiting for approval first. `null` until the first load. */
    couriers: CourierDTO[] | null
    /** Active orders on the first page of «Buyurtmalar»: `null` until it loads. */
    activeOrders: number | null
    setActiveOrders(count: number): void
    /** «Nusxa olish»: the product a new one starts from (the editor takes it once). */
    copyOf: ProductDTO | null
    copyProduct(product: ProductDTO | null): void
    /** «Sozlamalar» has edits not saved yet: leaving the tab asks first. */
    settingsDirty: boolean
    setSettingsDirty(dirty: boolean): void
    /** Another business opened: nothing of the previous one may show or be edited. */
    bindShop(id: string): void
    setTab(tab: OwnerTab): void
    focusOrder(id: string | null): void
    goToSection(section: ReadySection | null): void
    loadCouriers(): Promise<void>
    /** One courier changed (days, "not today"): swap it in place. */
    replaceCourier(courier: CourierDTO): void
    loadProducts(): Promise<void>
    upsert(product: ProductDTO): void
    /** «Ro'yxat bilan»: the products just made join the list and the storefront at once. */
    addMany(products: readonly ProductDTO[]): void
    drop(id: string): void
}

/** The storefront must show the owner's edits right away. */
function refreshStorefront(): void {
    loadCatalog()
        .then((products) => useSession.getState().setCatalog(products))
        .catch(() => undefined)
}

export const useOwner = create<OwnerState>((set, get) => ({
    shopId: null,
    tab: "orders",
    focusOrderId: null,
    focusSection: null,
    products: null,
    couriers: null,
    activeOrders: null,
    setActiveOrders: (count): void => set({ activeOrders: count }),
    copyOf: null,
    copyProduct: (product): void => set({ copyOf: product }),
    settingsDirty: false,
    setSettingsDirty: (dirty): void => set({ settingsDirty: dirty }),
    bindShop: (id): void => {
        if (get().shopId !== id) {
            // The order a bot message asked for stays: it belongs to the shop opening now.
            set({
                shopId: id,
                tab: "orders",
                focusSection: null,
                products: null,
                couriers: null,
                activeOrders: null,
            })
        }
    },
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
    addMany: (products): void => {
        set({ products: [...(get().products ?? []), ...products] })
        refreshStorefront()
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
