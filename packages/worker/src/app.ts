import { systemClock } from "@lls/core"
import { Hono } from "hono"
import { cors } from "hono/cors"

import { alertAdmins } from "./alerts.js"
import { INIT_DATA_HEADER, SHOP_HEADER, VIA_HEADER, authenticate } from "./auth.js"
import { toErrorResponse } from "./http/errors.js"
import { courierRoutes } from "./routes/courier.routes.js"
import { customerRoutes } from "./routes/customer.routes.js"
import { imageRoutes } from "./routes/image.routes.js"
import { moneyRoutes } from "./routes/money.routes.js"
import { ownerRoutes } from "./routes/owner.routes.js"
import { platformRoutes } from "./routes/platform.routes.js"
import { showcaseRoutes } from "./routes/showcase.routes.js"
import { webhookRoutes } from "./routes/webhook.routes.js"
import { createServices } from "./services.js"
import { HttpTelegramGateway, telegramApiBase } from "./telegram/gateway.js"

import type { AppEnv } from "./env.js"
import type { ServiceDeps } from "./services.js"

export function createApp(overrides: Partial<ServiceDeps> = {}): Hono<AppEnv> {
    const clock = overrides.clock ?? systemClock
    let gateway: HttpTelegramGateway | undefined

    const app = new Hono<AppEnv>()

    app.use(async (c, next) => {
        gateway ??= new HttpTelegramGateway(undefined, telegramApiBase(c.env.TELEGRAM_API_BASE))
        const deps: ServiceDeps = { telegram: overrides.telegram ?? gateway, clock }
        c.set("services", createServices(c.env, deps))
        await next()
    })

    app.use(
        "/api/*",
        cors({
            origin: (origin, c) => (origin === c.env.APP_ORIGIN ? origin : null),
            allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
            allowHeaders: ["Content-Type", INIT_DATA_HEADER, SHOP_HEADER, VIA_HEADER],
            maxAge: 86_400,
        }),
    )

    app.get("/health", (c) => c.json({ status: "ok" }))

    const api = new Hono<AppEnv>()
        .use(authenticate)
        .route("/", customerRoutes)
        .route("/owner", ownerRoutes)
        .route("/owner", moneyRoutes)
        .route("/courier", courierRoutes)
        .route("/platform", platformRoutes)
        .route("/showcase", showcaseRoutes)
    app.route("/api", api)
    app.route("/img", imageRoutes)
    app.route("/tg", webhookRoutes)

    app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404))
    app.onError((error, c) => {
        const { status, body } = toErrorResponse(error)
        if (status >= 500) {
            console.error(error)
            c.executionCtx.waitUntil(alertAdmins(c.get("services"), "server_error", error))
        }
        return c.json(body, status)
    })

    return app
}
