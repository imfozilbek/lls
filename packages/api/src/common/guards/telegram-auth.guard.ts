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

    private validateInitData(initData: string, _botToken: string): TelegramUser | null {
        try {
            const params = new URLSearchParams(initData)
            const userParam = params.get("user")

            if (!userParam) {
                return null
            }

            const user = JSON.parse(userParam) as {
                id: number
                first_name: string
                last_name?: string
                username?: string
                language_code?: string
            }

            // TODO: Implement proper HMAC validation with bot token
            // For now, just parse the user data
            // In production, use @telegram-apps/init-data-node

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
