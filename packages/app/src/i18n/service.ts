import type { uz } from "./uz.js"

type Dictionary = typeof uz

type Overrides<D> = {
    [K in keyof D]?: D[K] extends object ? Partial<D[K]> : never
}

/** Words that differ for services: a list of services, "being done", "done". */
export const SERVICE_UZ = (base: Dictionary): Overrides<Dictionary> => ({
    // A service delivers nothing (owner's decision, November 2026): the place is where the work
    // is done, and the money is paid after it.
    map: { ...base.map, outsideZone: "Bu yer xizmat hududidan tashqarida ({km} km gacha)" },
    errors: {
        ...base.errors,
        OUTSIDE_DELIVERY_ZONE:
            "Bu joy do'kon xizmat ko'rsatadigan hududdan tashqarida: yaqinroq manzil tanlang.",
        LOCATION_REQUIRED: "Xaritada manzilni belgilang: xizmat shu joyda ko'rsatiladi.",
    },
    shop: {
        ...base.shop,
        emptyTitle: "Xizmatlar hali yo'q",
        emptyText: "Xizmatlar tez orada qo'shiladi.",
        search: "Xizmatlardan qidirish",
        radius: "{km} km gacha xizmat ko'rsatamiz",
    },
    checkout: {
        ...base.checkout,
        pinRequired: "Majburiy: do'kon {km} km gacha xizmat ko'rsatadi.",
    },
    pay: {
        ...base.pay,
        cashChoice: "Naqd pul",
        cashToCourier: "Ishdan keyin {sum} naqd to'laysiz",
        cashOrder: "Naqd: ishdan keyin {sum} berasiz",
        cashExact: "To'lov ish bajarilgach olinadi.",
        cashStatus: { ...base.pay.cashStatus, unpaid: "Ishdan keyin to'lanadi" },
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
