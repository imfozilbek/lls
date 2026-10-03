import { systemClock } from "@zumda/core"
import { Hono } from "hono"
import { cors } from "hono/cors"

import { alertAdmins } from "./alerts.js"
import {
    AUTHORIZATION_HEADER,
    BOT_HEADER,
    INIT_DATA_HEADER,
    SHOP_HEADER,
    VIA_HEADER,
    authenticate,
} from "./auth.js"
import { toErrorResponse } from "./http/errors.js"
import { adminRoutes } from "./routes/admin.routes.js"
import { courierRoutes } from "./routes/courier.routes.js"
import { customerRoutes } from "./routes/customer.routes.js"
import { imageRoutes } from "./routes/image.routes.js"
import { moneyRoutes } from "./routes/money.routes.js"
import { ownerRoutes } from "./routes/owner.routes.js"
import { payoutCardRoutes } from "./routes/payout-card.routes.js"
import { platformRoutes } from "./routes/platform.routes.js"
import { showcaseRoutes } from "./routes/showcase.routes.js"
import { webSessionRoutes } from "./routes/web-session.routes.js"
import { webhookRoutes } from "./routes/webhook.routes.js"
import { createServices } from "./services.js"
import { HttpTelegramGateway, telegramApiBase } from "./telegram/gateway.js"

import type { AppEnv, Bindings } from "./env.js"
import type { ServiceDeps } from "./services.js"

/** The bare domain: it sends people to the customers' Zumda bot (the landing page comes later). */
const ROOT_HOST = "zumda.shop"
const SHOP_BOT_LINK = "https://t.me/zumdashop_bot"

/** The Mini App's addresses that may call the API: customers, businesses, couriers. */
function appOrigins(env: Bindings): string[] {
    return [env.APP_ORIGIN, env.BUSINESS_APP_ORIGIN, env.COURIER_APP_ORIGIN]
}

export function createApp(overrides: Partial<ServiceDeps> = {}): Hono<AppEnv> {
    const clock = overrides.clock ?? systemClock
    let gateway: HttpTelegramGateway | undefined

    const app = new Hono<AppEnv>()

    // zumda.shop itself: the customers' bot, until the landing page exists.
    app.use(async (c, next) => {
        if (new URL(c.req.url).hostname === ROOT_HOST) {
            return c.redirect(SHOP_BOT_LINK, 302)
        }
        await next()
        return undefined
    })

    app.use(async (c, next) => {
        gateway ??= new HttpTelegramGateway(undefined, telegramApiBase(c.env.TELEGRAM_API_BASE))
        const deps: ServiceDeps = { telegram: overrides.telegram ?? gateway, clock }
        c.set("services", createServices(c.env, deps))
        await next()
    })

    app.use(
        "/api/*",
        cors({
            origin: (origin, c) => (appOrigins(c.env).includes(origin) ? origin : null),
            allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
            allowHeaders: [
                "Content-Type",
                INIT_DATA_HEADER,
                SHOP_HEADER,
                VIA_HEADER,
                BOT_HEADER,
                AUTHORIZATION_HEADER,
            ],
            maxAge: 86_400,
        }),
    )

    app.get("/health", (c) => c.json({ status: "ok" }))

    // Before `/api` and its initData check: this is where a browser gets its session.
    app.route("/api/business", webSessionRoutes)

    const api = new Hono<AppEnv>()
        .use(authenticate)
        .route("/", customerRoutes)
        .route("/owner", ownerRoutes)
        .route("/owner", moneyRoutes)
        .route("/owner", payoutCardRoutes)
        .route("/courier", courierRoutes)
        .route("/platform", platformRoutes)
        .route("/admin", adminRoutes)
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
