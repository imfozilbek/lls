/** Fixed data for local runs. Never used in production: the bot tokens are fake. */
export interface DevShop {
    id: string
    slug: string
    name: string
    type: "food" | "water" | "grocery"
    brandColor: string
    owner: { id: number; first_name: string; language_code: string }
    bot: { id: number; username: string; token: string; webhookSecret: string }
}

/** The three pilot kinds of shop, each with its own bot and owner. */
export const DEV_SHOPS: readonly DevShop[] = [
    {
        id: "dev-food",
        slug: "osh-markaz-dev",
        name: "Osh Markaz",
        type: "food",
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
        slug: "toza-suv-dev",
        name: "Toza Suv",
        type: "water",
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
        slug: "baraka-market-dev",
        name: "Baraka Market",
        type: "grocery",
        brandColor: "#059669",
        owner: { id: 1003, first_name: "Nodira", language_code: "ru" },
        bot: {
            id: 100200302,
            username: "baraka_market_dev_bot",
            token: "100200302:DEV-local-only-token-not-a-real-bot-zz",
            webhookSecret: "dev-webhook-secret-grocery",
        },
    },
]

/** The LLS courier bot of the local stand. Fake token: never a real bot. */
export const DEV_COURIER_BOT = {
    id: 100200998,
    username: "lls_kuryer_dev_bot",
    token: "100200998:DEV-courier-token-not-a-real-bot-x",
    webhookSecret: "dev-courier-secret",
}

/** One courier who works for all three shops: a person may deliver for several. */
export const DEV_COURIER = { id: 3003, first_name: "Jasur", language_code: "uz" }
export const DEV_CUSTOMER = { id: 2002, first_name: "Aziz", language_code: "uz" }
export const DEV_ADMIN_ID = 9999

export function devShop(slug: string | undefined): DevShop {
    const shop = DEV_SHOPS.find((s) => s.slug === slug) ?? DEV_SHOPS[0]
    if (!shop) {
        throw new Error("No dev shops")
    }
    return shop
}
