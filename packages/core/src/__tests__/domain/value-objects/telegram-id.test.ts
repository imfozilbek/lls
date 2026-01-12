import { describe, it, expect } from "vitest"

import { TelegramId } from "../../../domain/value-objects/telegram-id.js"

describe("TelegramId", () => {
    describe("create", () => {
        it("should create telegram id with valid value", () => {
            const telegramId = TelegramId.create(123456789)
            expect(telegramId.value).toBe(123456789)
        })

        it("should throw on zero value", () => {
            expect(() => TelegramId.create(0)).toThrow()
        })

        it("should throw on negative value", () => {
            expect(() => TelegramId.create(-1)).toThrow()
        })
    })

    describe("equals", () => {
        it("should return true for equal ids", () => {
            const a = TelegramId.create(123456789)
            const b = TelegramId.create(123456789)
            expect(a.equals(b)).toBe(true)
        })

        it("should return false for different ids", () => {
            const a = TelegramId.create(123456789)
            const b = TelegramId.create(987654321)
            expect(a.equals(b)).toBe(false)
        })
    })

    describe("toString", () => {
        it("should return string representation", () => {
            const telegramId = TelegramId.create(123456789)
            expect(telegramId.toString()).toBe("123456789")
        })
    })
})
