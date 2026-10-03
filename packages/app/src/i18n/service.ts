import type { Dictionary } from "./uz.js"

type Overrides = {
    [K in keyof Dictionary]?: Dictionary[K] extends object ? Partial<Dictionary[K]> : never
}

/** Words that differ for services: a list of services, "being done", "done". */
export const SERVICE_UZ = (base: Dictionary): Overrides => ({
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
    owner: {
        ...base.owner,
        tabs: { ...base.owner.tabs, menu: "Xizmatlar" },
        actions: { ...base.owner.actions, preparing: "Bajarishni boshlash" },
        menuEmpty: "Xizmatlar yo'q",
        menuEmptyText: "Birinchi xizmatni qo'shing: mijozlar uni darhol ko'radi.",
    },
    courier: { ...base.courier, waitReady: "Buyurtma bajarilmoqda, tayyor bo'lganda xabar keladi" },
})
