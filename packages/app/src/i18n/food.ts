import type { uz } from "./uz.js"

type Dictionary = typeof uz

type Overrides<D> = {
    [K in keyof D]?: D[K] extends object ? Partial<D[K]> : never
}

/** Words that differ for shops that cook: a menu, "cooking", "enjoy your meal". */
export const FOOD_UZ = (base: Dictionary): Overrides<Dictionary> => ({
    shop: {
        ...base.shop,
        emptyTitle: "Menyu hali bo'sh",
        emptyText: "Do'kon tez orada menyuni to'ldiradi.",
        search: "Menyudan qidirish",
    },
    cart: { ...base.cart, emptyText: "Menyudan yoqqan narsangizni qo'shing.", toMenu: "Menyuga" },
    order: {
        ...base.order,
        steps: { ...base.order.steps, preparing: "Tayyorlanmoqda" },
        hints: {
            ...base.order.hints,
            preparing: "Buyurtmangiz tayyorlanmoqda",
            delivered: "Yoqimli ishtaha!",
        },
    },
})
