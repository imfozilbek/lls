import type { Dictionary } from "./uz.js"

type Overrides = {
    [K in keyof Dictionary]?: Dictionary[K] extends object ? Partial<Dictionary[K]> : never
}

/** Words that differ for shops that cook: a menu, "cooking", "enjoy your meal". */
export const FOOD_UZ = (base: Dictionary): Overrides => ({
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
    owner: {
        ...base.owner,
        tabs: { ...base.owner.tabs, menu: "Menyu" },
        actions: { ...base.owner.actions, preparing: "Tayyorlashni boshlash" },
        menuEmpty: "Menyu bo'sh",
        menuEmptyText: "Birinchi taomni qo'shing — mijozlar uni darhol ko'radi.",
    },
    courier: { ...base.courier, waitReady: "Taom tayyorlanmoqda — tayyor bo'lganda xabar keladi" },
})

export const FOOD_RU = (base: Dictionary): Overrides => ({
    shop: { ...base.shop, emptyTitle: "Меню пока пустое" },
    cart: { ...base.cart, emptyText: "Добавьте что-нибудь из меню.", toMenu: "В меню" },
    order: {
        ...base.order,
        steps: { ...base.order.steps, preparing: "Готовится" },
        hints: {
            ...base.order.hints,
            preparing: "Ваш заказ готовится",
            delivered: "Приятного аппетита!",
        },
    },
    owner: {
        ...base.owner,
        tabs: { ...base.owner.tabs, menu: "Меню" },
        actions: { ...base.owner.actions, preparing: "Начать готовить" },
        menuEmpty: "Меню пустое",
        menuEmptyText: "Добавьте первое блюдо — клиенты увидят его сразу.",
    },
    courier: { ...base.courier, waitReady: "Заказ готовится — бот напишет, когда будет готов" },
})
