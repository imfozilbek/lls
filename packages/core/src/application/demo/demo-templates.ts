import { BusinessType } from "../../domain/enums/business-type.js"
import { Feature } from "../../domain/enums/feature.js"
import { Unit } from "../../domain/enums/unit.js"

import type { Category } from "../../domain/enums/category.js"
import type { ProductOptionsProps } from "../../domain/value-objects/product-options.js"

/** A product of a demo sample: what an owner would type, priced, with its sizes and add-ons. */
export interface DemoProduct {
    name: string
    price: number
    unit: Unit
    category: Category
    /** Grams for weight units (kg, 100 g). */
    step?: number
    returnable?: boolean
    description?: string
    options?: ProductOptionsProps
}

/** The samples: one per kind of business, and water (a grocery store with bottles). */
export const DEMO_TEMPLATES = ["food", "grocery", "water", "service", "store"] as const
export type DemoTemplateKey = (typeof DEMO_TEMPLATES)[number]

export interface DemoTemplate {
    key: DemoTemplateKey
    /** The kind of shop the sample fills: water fills a grocery store. */
    type: BusinessType
    features: Feature[]
    /** Per bottle the customer keeps; 0 without bottles. */
    bottleDeposit: number
    products: readonly DemoProduct[]
}

/**
 * The test card of every demo shop: no bank issues a number of zeros, so nobody's money can land
 * on it. The holder says what it is.
 */
export const DEMO_CARD = { number: "0000000000000000", holder: "NAMUNA KARTA" } as const

const item = (
    name: string,
    price: number,
    unit: Unit,
    category: Category,
    extra: Partial<DemoProduct> = {},
): DemoProduct => ({ name, price, unit, category, ...extra })

/** Variants or add-ons of a demo product: ids are short and stable, like the app makes them. */
const options = (
    group: string,
    variants: [string, number][],
    addons: [string, number][] = [],
): ProductOptionsProps => ({
    group,
    variants: variants.map(([name, price], index) => ({ id: `v${index + 1}`, name, price })),
    addons: addons.map(([name, price], index) => ({ id: `a${index + 1}`, name, price })),
})

/**
 * Each sample's catalog. The stand's e2e specs order the first items (`dev-<shop>-p1`...): new
 * demo items go at the end, never in between. Built when asked: a module-level list of calls would
 * stay in every bundle that imports the core, the customer's too.
 */
const catalogOf = (key: DemoTemplateKey): readonly DemoProduct[] =>
    ({
        food: [
            item("To'y oshi", 45_000, Unit.PORTION, "meals", {
                description: "Devzira guruch, mol go'shti, sabzi va no'xat: qozonda, o'tinda.",
            }),
            item("Lag'mon", 38_000, Unit.PORTION, "soups"),
            item("Shashlik (mol go'shti)", 22_000, Unit.PIECE, "grill"),
            item("Achchiq-chuchuk", 12_000, Unit.PORTION, "salads"),
            item("Somsa tandir", 8_000, Unit.PIECE, "bakery"),
            item("Kompot 1 l", 15_000, Unit.LITER, "drinks"),
            item("Choyxona oshi", 25_000, Unit.PORTION, "osh", {
                description: "Kunduzgi osh: porsiyasini tanlang, qazi va bedana tuxumi bilan.",
                options: options(
                    "Porsiya",
                    [
                        ["0,5 porsiya", 25_000],
                        ["0,7 porsiya", 32_000],
                        ["1 porsiya", 42_000],
                    ],
                    [
                        ["Qazi", 15_000],
                        ["Bedana tuxumi", 5_000],
                    ],
                ),
            }),
            item("Xonim", 28_000, Unit.PORTION, "meals", {
                description: "Bug'da pishgan, kartoshka va go'sht bilan, qatiq bilan.",
            }),
            item("Ko'k choy (choynak)", 5_000, Unit.PIECE, "hot_drinks"),
        ],
        water: [
            item("Toza suv 19 l", 15_000, Unit.BOTTLE_19L, "water", {
                returnable: true,
                description: "Bo'sh idishni qaytarsangiz, garov olinmaydi.",
            }),
            item("Mineral suv 1,5 l", 6_000, Unit.PIECE, "water"),
            item("Kuler uchun pompa", 45_000, Unit.PIECE, "other"),
            item("Toza suv 5 l", 8_000, Unit.PIECE, "water"),
        ],
        grocery: [
            item("Pomidor", 12_000, Unit.KG, "produce", { step: 500 }),
            item("Kartoshka", 6_000, Unit.KG, "produce", { step: 1000 }),
            item("Mol go'shti", 95_000, Unit.KG, "meat", { step: 250 }),
            item("Sut 1 l", 11_000, Unit.PIECE, "dairy"),
            item("Non", 4_000, Unit.PIECE, "bakery"),
            item("Guruch (lazer)", 18_000, Unit.KG, "groceries", { step: 1000 }),
            item("Zira", 6_000, Unit.G100, "spices", {
                step: 100,
                description: "Osh uchun: 100 grammdan tortib beramiz.",
            }),
            item("Tuxum (10 dona)", 16_000, Unit.PACK, "eggs"),
            item("Olma", 14_000, Unit.KG, "produce", { step: 500 }),
        ],
        service: [
            item("Gilam yuvish (kv. metr)", 12_000, Unit.SQUARE_METRE, "carpet"),
            item("Avtomobil yuvish", 60_000, Unit.PIECE, "car_care"),
            item("Divan tozalash", 150_000, Unit.PIECE, "cleaning"),
            item("Ko'rpa yuvish", 40_000, Unit.PIECE, "laundry", {
                description: "Olib ketamiz va 2-3 kunda quritib qaytaramiz.",
            }),
            item("Salonni kimyoviy tozalash", 250_000, Unit.PIECE, "car_care", {
                options: options("Mashina", [
                    ["Sedan", 250_000],
                    ["Krossover", 320_000],
                    ["Jip", 400_000],
                ]),
            }),
            item("Parda yuvish", 20_000, Unit.PIECE, "cleaning"),
        ],
        store: [
            item("Kir yuvish kukuni 3 kg", 65_000, Unit.PACK, "chemicals"),
            item("Idish yuvish vositasi 1 l", 18_000, Unit.PIECE, "chemicals"),
            item("LED lampochka", 12_000, Unit.PIECE, "electrical", {
                description: "E27 patron, iliq yoki oq nur.",
                options: options("Quvvati", [
                    ["9 W", 12_000],
                    ["12 W", 15_000],
                    ["15 W", 19_000],
                ]),
            }),
            item("Chinni choynak", 55_000, Unit.PIECE, "kitchenware"),
            item("Ish qo'lqopi", 8_000, Unit.PAIR, "tools"),
            item("Elektr kabeli 2x1,5", 7_000, Unit.METRE, "electrical", {
                description: "Mis sim: kerakli uzunlikda kesib beramiz.",
            }),
        ],
    })[key]

/** Per bottle of the water sample. */
const DEMO_BOTTLE_DEPOSIT = 30_000

const SHAPES: Record<DemoTemplateKey, Omit<DemoTemplate, "key" | "products">> = {
    food: {
        type: BusinessType.FOOD,
        features: [Feature.REORDER, Feature.STOP_LIST],
        bottleDeposit: 0,
    },
    grocery: {
        type: BusinessType.GROCERY,
        features: [Feature.REORDER, Feature.WEIGHT_ITEMS, Feature.STOP_LIST],
        bottleDeposit: 0,
    },
    water: {
        type: BusinessType.GROCERY,
        features: [Feature.REORDER, Feature.BOTTLE_DEPOSIT],
        bottleDeposit: DEMO_BOTTLE_DEPOSIT,
    },
    service: { type: BusinessType.SERVICE, features: [Feature.REORDER], bottleDeposit: 0 },
    store: { type: BusinessType.STORE, features: [Feature.REORDER], bottleDeposit: 0 },
}

export function demoTemplate(key: DemoTemplateKey): DemoTemplate {
    return { key, ...SHAPES[key], products: catalogOf(key) }
}
