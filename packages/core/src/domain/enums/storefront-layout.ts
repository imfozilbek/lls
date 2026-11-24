/**
 * How the storefront shows the catalog (owner's decision, November 2026; goal 24): the owner
 * picks it in «Vitrina qanday ko'rinadi». Not chosen, the photos decide: a list when fewer than
 * half of the products have one, two columns otherwise. Stored as the value: only added, never
 * renamed.
 */
export enum StorefrontLayout {
    /** «Ikki ustunda»: two columns of cards. */
    GRID = "grid",
    /** «Ro'yxat ko'rinishida»: rows with a small photo, a card a category. */
    LIST = "list",
    /** «Katta rasm bilan»: one product a row, its photos swiped. */
    FEED = "feed",
    /** «Bo'limlarga ajratilgan»: a shelf a category, swiped sideways. */
    SHELVES = "shelves",
}

export const STOREFRONT_LAYOUTS: readonly StorefrontLayout[] = Object.values(StorefrontLayout)
