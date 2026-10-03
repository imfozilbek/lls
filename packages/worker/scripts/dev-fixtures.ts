/** Fixed data for local runs. Never used in production: the bot tokens are fake. */
export interface DevShop {
    id: string
    /** Inside the demo district around Gulistan. */
    location: { latitude: number; longitude: number }
    slug: string
    name: string
    /** The demo's own key: the water shop is a grocery store with bottles (`typeOf`). */
    kind: "food" | "water" | "grocery" | "service"
    brandColor: string
    owner: { id: number; first_name: string; language_code: string }
    bot: { id: number; username: string; token: string; webhookSecret: string }
}

/** The stored business type of a demo shop: a water shop is a grocery store with bottles. */
export function typeOf(shop: DevShop): "food" | "grocery" | "service" {
    return shop.kind === "water" ? "grocery" : shop.kind
}

/** The pilots' kinds of business, plus a service, each with its own bot and owner. */
export const DEV_SHOPS: readonly DevShop[] = [
    {
        id: "dev-food",
        location: { latitude: 40.492, longitude: 68.781 },
        slug: "osh-markaz-dev",
        name: "Osh Markaz",
        kind: "food",
        brandColor: "#d97706",
        owner: { id: 1001, first_name: "Rustam", language_code: "uz" },
        bot: {
            id: 100200300,
            username: "osh_markaz_dev_bot",
            token: "100200300:DEV-local-only-token-not-a-real-bot-xx",
            webhookSecret: "dev-webhook-secret-food",
        },
    },
    {
        id: "dev-water",
        location: { latitude: 40.485, longitude: 68.79 },
        slug: "toza-suv-dev",
        name: "Toza Suv",
        kind: "water",
        brandColor: "#0284c7",
        owner: { id: 1002, first_name: "Dilshod", language_code: "uz" },
        bot: {
            id: 100200301,
            username: "toza_suv_dev_bot",
            token: "100200301:DEV-local-only-token-not-a-real-bot-yy",
            webhookSecret: "dev-webhook-secret-water",
        },
    },
    {
        id: "dev-grocery",
        location: { latitude: 40.496, longitude: 68.775 },
        slug: "baraka-market-dev",
        name: "Baraka Market",
        kind: "grocery",
        brandColor: "#059669",
        owner: { id: 1003, first_name: "Nodira", language_code: "uz" },
        bot: {
            id: 100200302,
            username: "baraka_market_dev_bot",
            token: "100200302:DEV-local-only-token-not-a-real-bot-zz",
            webhookSecret: "dev-webhook-secret-grocery",
        },
    },
    {
        id: "dev-service",
        location: { latitude: 40.49, longitude: 68.786 },
        slug: "toza-gilam-dev",
        name: "Toza Gilam",
        kind: "service",
        brandColor: "#7c3aed",
        owner: { id: 1004, first_name: "Jasur", language_code: "uz" },
        bot: {
            id: 100200303,
            username: "toza_gilam_dev_bot",
            token: "100200303:DEV-local-only-token-not-a-real-bot-ww",
            webhookSecret: "dev-webhook-secret-service",
        },
    },
]

/** The Zumda courier bot of the local stand. Fake token: never a real bot. */
export const DEV_COURIER_BOT = {
    id: 100200998,
    username: "zumda_kuryer_dev_bot",
    token: "100200998:DEV-courier-token-not-a-real-bot-x",
    webhookSecret: "dev-courier-secret",
}

/** The Zumda Business bot of the local stand (owners, admins, Managed Bots). secret-scan: fake */
export const DEV_BUSINESS_BOT = {
    id: 100200997,
    username: "zumda_biznes_dev_bot",
    token: "100200997:DEV-business-token-not-a-real-bot",
    webhookSecret: "dev-business-secret",
}

/** One courier who works for all three shops: a person may deliver for several. */
export const DEV_COURIER = { id: 3003, first_name: "Jasur", language_code: "uz" }
/** The demo district of the delivery network: 30 km around Gulistan. */
export const DEV_DISTRICT = {
    id: "dev-district-guliston",
    name: "Guliston",
    latitude: 40.4897,
    longitude: 68.7842,
    radiusMeters: 30_000,
}

/**
 * District network couriers: each approved by one shop and in the network, on shift. Jasur, the
 * shops' own courier, is not in the network.
 */
export const DEV_NETWORK_COURIERS = [
    { id: 3005, first_name: "Otabek", language_code: "uz", shop: "dev-water" },
    { id: 3006, first_name: "Sherzod", language_code: "uz", shop: "dev-grocery" },
] as const

export const DEV_CUSTOMER = { id: 2002, first_name: "Aziz", language_code: "uz" }
export const DEV_ADMIN_ID = 9999

export function devShop(slug: string | undefined): DevShop {
    const shop = DEV_SHOPS.find((s) => s.slug === slug) ?? DEV_SHOPS[0]
    if (!shop) {
        throw new Error("No dev shops")
    }
    return shop
}
