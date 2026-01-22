import { createHmac } from "crypto"

import { Injectable, UnauthorizedException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

import type { AppConfig } from "../../config/configuration.js"

export interface TelegramLoginData {
    id: number
    first_name: string
    last_name?: string
    username?: string
    photo_url?: string
    auth_date: number
    hash: string
}

const MAX_AUTH_AGE_SECONDS = 300 // 5 minutes

@Injectable()
export class TelegramAuthService {
    constructor(private readonly configService: ConfigService<AppConfig>) {}

    validateTelegramLogin(data: TelegramLoginData): void {
        const botToken = this.configService.get("telegramBotToken")
        if (!botToken) {
            throw new UnauthorizedException("Telegram bot not configured")
        }

        this.validateAuthDate(data.auth_date)
        this.validateSignature(data, botToken)
    }

    private validateAuthDate(authDate: number): void {
        const currentTimestamp = Math.floor(Date.now() / 1000)
        const age = currentTimestamp - authDate

        if (age > MAX_AUTH_AGE_SECONDS) {
            throw new UnauthorizedException("Telegram auth data expired")
        }
    }

    private validateSignature(data: TelegramLoginData, botToken: string): void {
        const { hash, ...dataWithoutHash } = data

        const dataCheckString = Object.keys(dataWithoutHash)
            .sort()
            .filter((key) => dataWithoutHash[key as keyof typeof dataWithoutHash] !== undefined)
            .map((key) => `${key}=${dataWithoutHash[key as keyof typeof dataWithoutHash]}`)
            .join("\n")

        const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest()
        const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex")

        if (hash !== expectedHash) {
            throw new UnauthorizedException("Invalid Telegram signature")
        }
    }
}
