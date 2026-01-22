import { createHmac } from "crypto"

import { UnauthorizedException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TelegramAuthService } from "../../common/services/telegram-auth.service.js"

import type { TelegramLoginData } from "../../common/services/telegram-auth.service.js"

describe("TelegramAuthService", () => {
    let service: TelegramAuthService
    let mockConfigService: { get: ReturnType<typeof vi.fn> }

    const BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"

    const generateValidHash = (data: Omit<TelegramLoginData, "hash">): string => {
        const dataCheckString = Object.keys(data)
            .sort()
            .filter((key) => data[key as keyof typeof data] !== undefined)
            .map((key) => `${key}=${data[key as keyof typeof data]}`)
            .join("\n")

        const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest()
        return createHmac("sha256", secretKey).update(dataCheckString).digest("hex")
    }

    const createValidLoginData = (): TelegramLoginData => {
        const data = {
            id: 123456789,
            first_name: "Test",
            auth_date: Math.floor(Date.now() / 1000),
        }
        return {
            ...data,
            hash: generateValidHash(data),
        }
    }

    beforeEach(() => {
        mockConfigService = { get: vi.fn() }
        mockConfigService.get.mockReturnValue(BOT_TOKEN)
        service = new TelegramAuthService(mockConfigService as unknown as ConfigService)
    })

    it("should validate correct telegram login data", () => {
        const data = createValidLoginData()

        expect(() => service.validateTelegramLogin(data)).not.toThrow()
    })

    it("should throw when bot token is not configured", () => {
        mockConfigService.get.mockReturnValue(undefined)
        const data = createValidLoginData()

        expect(() => service.validateTelegramLogin(data)).toThrow(UnauthorizedException)
        expect(() => service.validateTelegramLogin(data)).toThrow("Telegram bot not configured")
    })

    it("should throw on invalid hash", () => {
        const data = createValidLoginData()
        data.hash = "invalid_hash"

        expect(() => service.validateTelegramLogin(data)).toThrow(UnauthorizedException)
        expect(() => service.validateTelegramLogin(data)).toThrow("Invalid Telegram signature")
    })

    it("should throw on expired auth_date", () => {
        const data = {
            id: 123456789,
            first_name: "Test",
            auth_date: Math.floor(Date.now() / 1000) - 600, // 10 minutes ago
        }
        const hash = generateValidHash(data)

        expect(() => service.validateTelegramLogin({ ...data, hash })).toThrow(
            UnauthorizedException,
        )
        expect(() => service.validateTelegramLogin({ ...data, hash })).toThrow(
            "Telegram auth data expired",
        )
    })

    it("should accept auth_date within 5 minutes", () => {
        const data = {
            id: 123456789,
            first_name: "Test",
            auth_date: Math.floor(Date.now() / 1000) - 240, // 4 minutes ago
        }
        const hash = generateValidHash(data)

        expect(() => service.validateTelegramLogin({ ...data, hash })).not.toThrow()
    })

    it("should validate with all optional fields present", () => {
        const data = {
            id: 123456789,
            first_name: "Test",
            last_name: "User",
            username: "testuser",
            photo_url: "https://t.me/photo.jpg",
            auth_date: Math.floor(Date.now() / 1000),
        }
        const hash = generateValidHash(data)

        expect(() => service.validateTelegramLogin({ ...data, hash })).not.toThrow()
    })
})
