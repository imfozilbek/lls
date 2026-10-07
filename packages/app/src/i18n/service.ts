import type { StaffDictionary } from "./staff.js"
import type { uz } from "./uz.js"

type Dictionary = typeof uz

type Overrides<D> = {
    [K in keyof D]?: D[K] extends object ? Partial<D[K]> : never
}

/** Words that differ for services: a list of services, "being done", "done". */
export const SERVICE_UZ = (base: Dictionary): Overrides<Dictionary> => ({
    shop: { ...base.shop, emptyTitle: "Xizmatlar hali yo'q" },
    cart: {
        ...base.cart,
        emptyText: "Kerakli xizmatni tanlang va qo'shing.",
        toMenu: "Xizmatlarga",
    },
    order: {
        ...base.order,
        steps: { ...base.order.steps, preparing: "Bajarilmoqda" },
        hints: {
            ...base.order.hints,
            preparing: "Buyurtmangiz bajarilmoqda",
            delivered: "Bajarildi. Rahmat!",
        },
    },
})

/** The same kind of words for the owner and the courier (lazy, with `staff.ts`). */
export const SERVICE_STAFF = (base: StaffDictionary): Overrides<StaffDictionary> => ({
    owner: {
        ...base.owner,
        tabs: { ...base.owner.tabs, menu: "Xizmatlar" },
        actions: { ...base.owner.actions, preparing: "Bajarishni boshlash" },
        menuEmpty: "Xizmatlar yo'q",
        menuEmptyText: "Birinchi xizmatni qo'shing: mijozlar uni darhol ko'radi.",
    },
    courier: { ...base.courier, waitReady: "Buyurtma bajarilmoqda, tayyor bo'lganda xabar keladi" },
})
