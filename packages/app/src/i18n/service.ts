import type { uz } from "./uz.js"

type Dictionary = typeof uz

type Overrides<D> = {
    [K in keyof D]?: D[K] extends object ? Partial<D[K]> : never
}

/** Words that differ for services: a list of services, "being done", "done". */
export const SERVICE_UZ = (base: Dictionary): Overrides<Dictionary> => ({
    shop: {
        ...base.shop,
        emptyTitle: "Xizmatlar hali yo'q",
        emptyText: "Do'kon tez orada xizmatlarni qo'shadi.",
        search: "Xizmatlardan qidirish",
    },
    cart: {
        ...base.cart,
        emptyText: "Kerakli xizmatni tanlang va qo'shing.",
        toMenu: "Xizmatlarga",
        subtotal: "Xizmatlar",
    },
    order: {
        ...base.order,
        itemsCount: "{n} xil xizmat",
        steps: { ...base.order.steps, preparing: "Bajarilmoqda", delivered: "Bajarildi" },
        hints: {
            ...base.order.hints,
            preparing: "Buyurtmangiz bajarilmoqda",
            delivered: "Bajarildi. Rahmat!",
        },
    },
})
