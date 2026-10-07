import type { StaffDictionary } from "./staff.js"
import type { uz } from "./uz.js"

type Dictionary = typeof uz

type Overrides<D> = {
    [K in keyof D]?: D[K] extends object ? Partial<D[K]> : never
}

/** Words that differ for shops that cook: a menu, "cooking", "enjoy your meal". */
export const FOOD_UZ = (base: Dictionary): Overrides<Dictionary> => ({
    shop: { ...base.shop, emptyTitle: "Menyu hali bo'sh" },
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

/** The same kind of words for the owner and the courier (lazy, with `staff.ts`). */
export const FOOD_STAFF = (base: StaffDictionary): Overrides<StaffDictionary> => ({
    owner: {
        ...base.owner,
        tabs: { ...base.owner.tabs, menu: "Menyu" },
        actions: { ...base.owner.actions, preparing: "Tayyorlashni boshlash" },
        menuEmpty: "Menyu bo'sh",
        menuEmptyText: "Birinchi taomni qo'shing: mijozlar uni darhol ko'radi.",
    },
    courier: { ...base.courier, waitReady: "Taom tayyorlanmoqda, tayyor bo'lganda xabar keladi" },
})
