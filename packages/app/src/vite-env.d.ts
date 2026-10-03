/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Worker URL, e.g. https://zumda-worker.<account>.workers.dev. Defaults to wrangler dev. */
    readonly VITE_API_URL?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
