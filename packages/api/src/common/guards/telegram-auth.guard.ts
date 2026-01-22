import { createHmac } from "crypto"

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

import type { AppConfig } from "../../config/configuration.js"
import type { FastifyRequest } from "fastify"

export interface TelegramUser {
    id: number
    firstName: string
    lastName?: string
    username?: string
    languageCode?: string
}

const MAX_AUTH_AGE_SECONDS = 86400 // 24 hours for Mini App sessions

@Injectable()
export class TelegramAuthGuard implements CanActivate {
    constructor(private readonly configService: ConfigService<AppConfig>) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<FastifyRequest>()
        const initData = request.headers["x-telegram-init-data"] as string | undefined

        if (!initData) {
            throw new UnauthorizedException("Missing Telegram init data")
        }

        const botToken = this.configService.get("telegramBotToken")
        if (!botToken) {
            throw new UnauthorizedException("Telegram bot not configured")
        }

        const user = this.validateInitData(initData, botToken)
        if (!user) {
            throw new UnauthorizedException("Invalid Telegram init data")
        }

        ;(request as unknown as { telegramUser: TelegramUser }).telegramUser = user
        return true
    }

    private validateInitData(initData: string, botToken: string): TelegramUser | null {
        try {
            const params = new URLSearchParams(initData)
            const hash = params.get("hash")
            const userParam = params.get("user")
            const authDateParam = params.get("auth_date")

            if (!hash || !userParam || !authDateParam) {
                return null
            }

            // Validate auth_date is not too old
            const authDate = parseInt(authDateParam, 10)
            const currentTimestamp = Math.floor(Date.now() / 1000)
            if (currentTimestamp - authDate > MAX_AUTH_AGE_SECONDS) {
                return null
            }

            // Build data check string (sorted params without hash, newline separated)
            const dataCheckArr: string[] = []
            params.forEach((value, key) => {
                if (key !== "hash") {
                    dataCheckArr.push(`${key}=${value}`)
                }
            })
            dataCheckArr.sort()
            const dataCheckString = dataCheckArr.join("\n")

            // Validate HMAC signature
            const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest()
            const expectedHash = createHmac("sha256", secretKey)
                .update(dataCheckString)
                .digest("hex")

            if (hash !== expectedHash) {
                return null
            }

            // Parse user data
            const user = JSON.parse(userParam) as {
                id: number
                first_name: string
                last_name?: string
                username?: string
                language_code?: string
            }

            return {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                username: user.username,
                languageCode: user.language_code,
            }
        } catch {
            return null
        }
    }
}
