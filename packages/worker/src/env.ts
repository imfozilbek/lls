export interface Bindings {
    DB: D1Database
    BUCKET: R2Bucket
    APP_ORIGIN: string
}

export interface AppEnv {
    Bindings: Bindings
}
