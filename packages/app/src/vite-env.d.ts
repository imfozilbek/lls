/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Worker URL: https://api.zumda.shop in production. Defaults to wrangler dev. */
    readonly VITE_API_URL?: string
    /** The Zumda | Business bot's username, for the Login Widget on business.zumda.shop. */
    readonly VITE_BUSINESS_BOT?: string
    /** Public photos straight from R2 (https://media.zumda.shop). Defaults to the Worker's /img. */
    readonly VITE_MEDIA_URL?: string
    /** The map straight from R2 (https://map.zumda.shop). Defaults to the Worker. */
    readonly VITE_MAP_URL?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
