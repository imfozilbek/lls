/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Worker URL: https://api.zumda.shop in production. Defaults to wrangler dev. */
    readonly VITE_API_URL?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
