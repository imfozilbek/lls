import cors from "@fastify/cors"
import Fastify from "fastify"

import { logger } from "./utils/logger.js"

export async function buildApp(): Promise<ReturnType<typeof Fastify>> {
    const app = Fastify({
        logger,
    })

    await app.register(cors, {
        origin: true,
    })

    app.get("/health", async () => {
        return { status: "ok", timestamp: new Date().toISOString() }
    })

    app.get("/ready", async () => {
        return { status: "ready", timestamp: new Date().toISOString() }
    })

    return app
}
