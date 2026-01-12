import "reflect-metadata"
import { ValidationPipe } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify"

import { AppModule } from "./app.module.js"
import { logger } from "./common/logger.js"
import { configuration } from "./config/configuration.js"

async function bootstrap(): Promise<void> {
    const config = configuration()

    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter(),
        {
            logger: ["error", "warn", "log"],
        },
    )

    app.enableCors({
        origin: true,
    })

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
        }),
    )

    app.setGlobalPrefix("api/v1", {
        exclude: ["health", "ready"],
    })

    const shutdown = async (): Promise<void> => {
        logger.info("Shutting down...")
        await app.close()
        process.exit(0)
    }

    process.on("SIGTERM", shutdown)
    process.on("SIGINT", shutdown)

    await app.listen(config.port, config.host)
    logger.info(`Server listening on ${config.host}:${config.port}`)
}

bootstrap().catch((err: unknown) => {
    logger.error(err)
    process.exit(1)
})
