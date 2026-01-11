import { buildApp } from "./app.js"
import { env } from "./config/env.js"
import { logger } from "./utils/logger.js"

async function main(): Promise<void> {
    const app = await buildApp()

    const shutdown = async (): Promise<void> => {
        logger.info("Shutting down...")
        await app.close()
        process.exit(0)
    }

    process.on("SIGTERM", shutdown)
    process.on("SIGINT", shutdown)

    try {
        await app.listen({ port: env.PORT, host: env.HOST })
        logger.info(`Server listening on ${env.HOST}:${env.PORT}`)
    } catch (err) {
        logger.error(err)
        process.exit(1)
    }
}

main().catch((err) => {
    logger.error(err)
    process.exit(1)
})
