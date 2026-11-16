import type { StaffDictionary } from "./staff.js"

/**
 * The owner's and the courier's words that differ by kind of business. Only the staff chunk
 * imports this file (`staff-register.ts`), so a customer never downloads it.
 */
type Overrides<D> = {
    [K in keyof D]?: D[K] extends object ? Partial<D[K]> : never
}

/** A shop that cooks: a menu, "cooking". */
export const FOOD_STAFF = (base: StaffDictionary): Overrides<StaffDictionary> => ({
    owner: {
        ...base.owner,
        tabs: { ...base.owner.tabs, menu: "Menyu" },
        actions: { ...base.owner.actions, preparing: "Tayyorlashni boshlash" },
        queueBadge: "Tayyorlash kerak",
        picking: {
            ...base.owner.picking,
            counter: "Tayyor: {done} / {all}",
            allDone: "Hammasi tayyor",
        },
        menuEmpty: "Menyu bo'sh",
        menuEmptyText: "Birinchi taomni qo'shing: mijozlar uni darhol ko'radi.",
    },
    courier: { ...base.courier, waitReady: "Taom tayyorlanmoqda, tayyor bo'lganda xabar keladi" },
})

/** A service: «Xizmatlar», "being done". */
export const SERVICE_STAFF = (base: StaffDictionary): Overrides<StaffDictionary> => ({
    owner: {
        ...base.owner,
        tabs: { ...base.owner.tabs, menu: "Xizmatlar" },
        actions: { ...base.owner.actions, preparing: "Bajarishni boshlash" },
        queueBadge: "Bajarish kerak",
        menuEmpty: "Xizmatlar yo'q",
        menuEmptyText: "Birinchi xizmatni qo'shing: mijozlar uni darhol ko'radi.",
    },
    courier: { ...base.courier, waitReady: "Buyurtma bajarilmoqda, tayyor bo'lganda xabar keladi" },
})
