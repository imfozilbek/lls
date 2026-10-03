/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Worker URL: https://api.zumda.shop in production. Defaults to wrangler dev. */
    readonly VITE_API_URL?: string
    /** The Zumda | Business bot's username, for the Login Widget on business.zumda.shop. */
    readonly VITE_BUSINESS_BOT?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
