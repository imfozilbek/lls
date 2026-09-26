import { describe, expect, it } from "vitest"

import { ValidationError } from "../../../domain/errors/validation.error.js"
import { BrandColor } from "../../../domain/value-objects/brand-color.js"
import { Location, mapUrl } from "../../../domain/value-objects/location.js"
import { Money } from "../../../domain/value-objects/money.js"
import { Phone, formatPhone } from "../../../domain/value-objects/phone.js"
import { Slug } from "../../../domain/value-objects/slug.js"
import { TelegramId } from "../../../domain/value-objects/telegram-id.js"

describe("Money", () => {
    it("accepts only non-negative whole sums", () => {
        expect(Money.of(15_000).amount).toBe(15_000)
        expect(Money.zero().amount).toBe(0)
        expect(Money.optional(0)).toBeUndefined()
        expect(Money.optional(null)).toBeUndefined()
        expect(Money.optional(50_000)?.amount).toBe(50_000)
        for (const bad of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 60]) {
            expect(() => Money.of(bad)).toThrow(ValidationError)
        }
    })

    it("adds, multiplies and compares", () => {
        const price = Money.of(12_000)
        expect(price.add(Money.of(3_000)).amount).toBe(15_000)
        expect(price.multiply(3).amount).toBe(36_000)
        expect(() => price.multiply(1.5)).toThrow(ValidationError)
        expect(() => price.multiply(-1)).toThrow(ValidationError)
        expect(price.isLessThan(Money.of(12_001))).toBe(true)
        expect(price.isAtLeast(Money.of(12_000))).toBe(true)
        expect(price.amount).toBe(12_000)
    })
})

describe("Location", () => {
    it("validates ranges", () => {
        expect(Location.create(41.31, 69.28).latitude).toBe(41.31)
        expect(() => Location.create(91, 0)).toThrow(ValidationError)
        expect(() => Location.create(0, -181)).toThrow(ValidationError)
        expect(() => Location.create(Number.NaN, 0)).toThrow(ValidationError)
    })

    it("measures distance in meters", () => {
        const a = Location.create(41.3111, 69.2797)
        const b = Location.create(41.3111, 69.2917)
        const distance = a.distanceTo(b)
        expect(distance).toBeGreaterThan(950)
        expect(distance).toBeLessThan(1050)
        expect(a.distanceTo(a)).toBe(0)
        expect(a).toEqual(Location.create(41.3111, 69.2797))
    })
})

describe("mapUrl", () => {
    it("points Yandex Maps at the location", () => {
        expect(mapUrl({ latitude: 40.49, longitude: 68.78 })).toBe(
            "https://yandex.uz/maps/?pt=68.78,40.49&z=17&l=map",
        )
    })
})

describe("Phone", () => {
    it("normalizes Uzbek numbers from any format", () => {
        expect(Phone.create("+998 90 123-45-67").number).toBe("+998901234567")
        expect(Phone.create("998901234567").number).toBe("+998901234567")
        expect(Phone.create("901234567").number).toBe("+998901234567")
        expect(formatPhone(Phone.create("998901234567").number)).toBe("+998 90 123 45 67")
    })

    it("accepts foreign numbers as E.164", () => {
        const phone = Phone.create("+7 701 123 4567")
        expect(phone.number).toBe("+77011234567")
        expect(formatPhone(phone.number)).toBe("+77011234567")
    })

    it("rejects garbage", () => {
        expect(() => Phone.create("123")).toThrow(ValidationError)
        expect(() => Phone.create("")).toThrow(ValidationError)
        expect(Phone.create("901234567").number).toBe(Phone.create("+998901234567").number)
    })
})

describe("TelegramId", () => {
    it("must be a positive integer", () => {
        expect(TelegramId.create(42).value).toBe(42)
        expect(() => TelegramId.create(0)).toThrow(ValidationError)
        expect(() => TelegramId.create(1.5)).toThrow(ValidationError)
        expect(TelegramId.create(42).value).toBe(42)
    })
})

describe("Slug", () => {
    it("validates format", () => {
        expect(Slug.create("osh-markaz").value).toBe("osh-markaz")
        for (const bad of ["ab", "-osh", "osh-", "Osh", "osh--markaz", "a".repeat(41), "ош"]) {
            expect(() => Slug.create(bad)).toThrow(ValidationError)
        }
    })

    it("derives from bot username", () => {
        expect(Slug.fromBotUsername("Osh_Markaz_bot").value).toBe("osh-markaz")
        expect(Slug.fromBotUsername("suvbot").value).toBe("suv")
        expect(Slug.fromBotUsername("ab_bot").value).toBe("ab-bot")
    })

    it("adds a numeric suffix", () => {
        expect(Slug.create("osh-markaz").withSuffix(2).value).toBe("osh-markaz-2")
        expect(Slug.create("a".repeat(40)).withSuffix(12).value).toHaveLength(40)
        expect(Slug.create("osh").value).toBe("osh")
    })
})

describe("BrandColor", () => {
    it("normalizes hex colors", () => {
        expect(BrandColor.create(" #0EA5E9 ").hex).toBe("#0ea5e9")
        expect(BrandColor.default().hex).toBe("#0ea5e9")
        expect(() => BrandColor.create("blue")).toThrow(ValidationError)
        expect(() => BrandColor.create("#fff")).toThrow(ValidationError)
    })
})
