import { systemClock } from "@zumda/core"
import { Hono } from "hono"
import { cors } from "hono/cors"

import { alertAdmins, isRecipientProblem, requestPlace } from "./alerts.js"
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
import { mapRoutes } from "./routes/map.routes.js"
import { moneyRoutes } from "./routes/money.routes.js"
import { ownerRoutes } from "./routes/owner.routes.js"
import { payoutCardRoutes } from "./routes/payout-card.routes.js"
import { platformRoutes } from "./routes/platform.routes.js"
import { showcaseRoutes } from "./routes/showcase.routes.js"
import { webSessionRoutes } from "./routes/web-session.routes.js"
import { webhookRoutes } from "./routes/webhook.routes.js"
import { createServices } from "./services.js"
import { HttpTelegramGateway, telegramApiBase } from "./telegram/gateway.js"
import { publishedKeys, telegramOauthBase } from "./telegram-login.js"

import type { AppEnv, Bindings } from "./env.js"
import type { ServiceDeps, Services } from "./services.js"

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

    const servicesFor = (env: AppEnv["Bindings"]): Services => {
        gateway ??= new HttpTelegramGateway(undefined, telegramApiBase(env.TELEGRAM_API_BASE))
        const deps: ServiceDeps = {
            telegram: overrides.telegram ?? gateway,
            clock,
            loginKeys:
                overrides.loginKeys ?? publishedKeys(telegramOauthBase(env.TELEGRAM_OAUTH_BASE)),
        }
        return createServices(env, deps)
    }

    // Only the API and the bots use the services: photos, the map, /health and a CORS preflight
    // never build sixty objects for nothing.
    app.use(async (c, next) => {
        const path = new URL(c.req.url).pathname
        const needed = path.startsWith("/api/") || path.startsWith("/tg/")
        if (needed && c.req.method !== "OPTIONS") {
            c.set("services", servicesFor(c.env))
        }
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
    app.route("/map", mapRoutes)
    app.route("/tg", webhookRoutes)

    app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404))
    app.onError((error, c) => {
        const { status, body } = toErrorResponse(error)
        // An owner who blocked his own bot is not an outage: no alarm for that.
        if (status >= 500 && !isRecipientProblem(error)) {
            console.error(error)
            const where = requestPlace(c.req.method, c.req.url)
            const services = (c.var.services as Services | undefined) ?? servicesFor(c.env)
            c.executionCtx.waitUntil(alertAdmins(services, "server_error", error, where))
        }
        return c.json(body, status)
    })

    return app
}
