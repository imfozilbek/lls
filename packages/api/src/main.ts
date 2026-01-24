import "reflect-metadata"
import helmet from "@fastify/helmet"
import { ValidationPipe } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"

import { AppModule } from "./app.module.js"
import { logger } from "./common/logger.js"
import { configuration } from "./config/configuration.js"

async function bootstrap(): Promise<void> {
    const config = configuration()

    const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
        logger: ["error", "warn", "log"],
    })

    // Security: Register Helmet for security headers
    await app.register(helmet, {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"],
                scriptSrc: ["'self'"],
            },
        },
        crossOriginEmbedderPolicy: false,
    })

    // Security: CORS with specific origins (not wildcard)
    app.enableCors({
        origin: config.nodeEnv === "development" ? true : config.corsOrigins,
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Telegram-Init-Data"],
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

    // Swagger API Documentation
    const swaggerConfig = new DocumentBuilder()
        .setTitle("LLS API")
        .setDescription("LocalLoopSolutions - Local Delivery Platform API")
        .setVersion("1.0")
        .addTag("businesses", "Business management endpoints")
        .addTag("products", "Product catalog endpoints")
        .addTag("orders", "Order management endpoints")
        .addTag("customers", "Customer endpoints")
        .addTag("couriers", "Courier endpoints")
        .addTag("analytics", "Analytics and reporting")
        .addApiKey(
            { type: "apiKey", name: "X-Telegram-Init-Data", in: "header" },
            "telegram-auth",
        )
        .addApiKey(
            { type: "apiKey", name: "X-Business-Telegram-Id", in: "header" },
            "business-auth",
        )
        .build()

    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup("docs", app, document, {
        swaggerOptions: {
            persistAuthorization: true,
        },
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
