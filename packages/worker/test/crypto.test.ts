import { describe, expect, it } from "vitest"

import {
    decryptSecret,
    encryptSecret,
    randomToken,
    timingSafeEqual,
    verifyInitData,
} from "../src/crypto.js"

import { CUSTOMER, SHOP_BOT_TOKEN, OTHER_BOT_TOKEN, signInitData } from "./helpers.js"

const KEY = "a2tra2tra2tra2tra2tra2tra2tra2tra2tra2tra2s="

describe("verifyInitData", () => {
    it("accepts data signed by the same bot", async () => {
        const initData = await signInitData(CUSTOMER, SHOP_BOT_TOKEN)
        const verified = await verifyInitData(initData, SHOP_BOT_TOKEN, new Date())
        expect(verified?.user).toEqual({
            id: 2002,
            firstName: "Aziz",
            lastName: "Karimov",
            username: undefined,
            languageCode: "ru",
        })
    })

    it("rejects data signed by another bot", async () => {
        const initData = await signInitData(CUSTOMER, OTHER_BOT_TOKEN)
        expect(await verifyInitData(initData, SHOP_BOT_TOKEN, new Date())).toBeNull()
    })

    it("rejects tampered data", async () => {
        const initData = await signInitData(CUSTOMER, SHOP_BOT_TOKEN)
        const tampered = initData.replace("2002", "1001")
        expect(await verifyInitData(tampered, SHOP_BOT_TOKEN, new Date())).toBeNull()
        expect(await verifyInitData("user=%7B%7D", SHOP_BOT_TOKEN, new Date())).toBeNull()
    })

    it("rejects data older than 24 hours or from the future", async () => {
        const now = new Date("2026-09-28T12:00:00Z")
        const old = await signInitData(CUSTOMER, SHOP_BOT_TOKEN, new Date("2026-09-27T11:59:00Z"))
        expect(await verifyInitData(old, SHOP_BOT_TOKEN, now)).toBeNull()
        const future = await signInitData(
            CUSTOMER,
            SHOP_BOT_TOKEN,
            new Date("2026-09-28T12:05:00Z"),
        )
        expect(await verifyInitData(future, SHOP_BOT_TOKEN, now)).toBeNull()
        const fresh = await signInitData(CUSTOMER, SHOP_BOT_TOKEN, new Date("2026-09-28T11:00:00Z"))
        expect(await verifyInitData(fresh, SHOP_BOT_TOKEN, now)).not.toBeNull()
    })

    it("rejects a signed payload without a valid user", async () => {
        const noUser = await signInitData({ first_name: "x" }, SHOP_BOT_TOKEN)
        expect(await verifyInitData(noUser, SHOP_BOT_TOKEN, new Date())).toBeNull()
    })
})

describe("secrets", () => {
    it("encrypts with a random IV and decrypts back", async () => {
        const a = await encryptSecret("777:token", KEY)
        const b = await encryptSecret("777:token", KEY)
        expect(a).not.toBe(b)
        expect(a).not.toContain("777")
        expect(await decryptSecret(a, KEY)).toBe("777:token")
    })

    it("random tokens are URL-safe and unique", () => {
        const token = randomToken()
        expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/)
        expect(randomToken()).not.toBe(token)
    })

    it("timingSafeEqual", () => {
        expect(timingSafeEqual("abc", "abc")).toBe(true)
        expect(timingSafeEqual("abc", "abd")).toBe(false)
        expect(timingSafeEqual("abc", "abcd")).toBe(false)
        expect(timingSafeEqual("abc", "")).toBe(false)
    })
})
