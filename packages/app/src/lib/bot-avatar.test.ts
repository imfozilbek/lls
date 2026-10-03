import { describe, expect, it, vi } from "vitest"

import { ApiError } from "./api.js"
import { avatarLines, initials } from "./bot-avatar.js"
import { BOT_PHOTO_FAILED, updateBotPhoto } from "./bot-photo.js"

vi.mock("./bot-avatar.js", async (load) => ({
    ...(await load<typeof import("./bot-avatar.js")>()),
    drawBotAvatar: vi.fn(() => Promise.resolve(new Blob(["jpeg"], { type: "image/jpeg" }))),
}))

describe("the shop bot's picture from its name", () => {
    it("tries the name on one line, then every two-line split", () => {
        expect(avatarLines("Suv")).toEqual([["Suv"]])
        expect(avatarLines("  Osh   Markaz Saroy ")).toEqual([
            ["Osh Markaz Saroy"],
            ["Osh", "Markaz Saroy"],
            ["Osh Markaz", "Saroy"],
        ])
    })

    it("falls back to the first letters of two words", () => {
        expect(initials("osh markaz saroy")).toBe("OM")
        expect(initials("Suv")).toBe("S")
        expect(initials("Ёқимли таом")).toBe("ЁТ")
    })
})

describe("updateBotPhoto", () => {
    it("sends the drawn JPEG and reports success", async () => {
        const send = vi.fn(() => Promise.resolve())
        const input = { shopName: "Osh", brandColor: "#15803d", logo: null }
        expect(await updateBotPhoto(input, send)).toBeNull()
        expect(send).toHaveBeenCalledOnce()
    })

    it("returns the Worker's code, or its own, instead of throwing", async () => {
        const input = { shopName: "Osh", brandColor: "#15803d", logo: null }
        const refused = (): Promise<void> =>
            Promise.reject(new ApiError(502, "BOT_PHOTO_FAILED", "Telegram said no"))
        expect(await updateBotPhoto(input, refused)).toBe("BOT_PHOTO_FAILED")
        const broken = (): Promise<void> => Promise.reject(new Error("canvas"))
        expect(await updateBotPhoto(input, broken)).toBe(BOT_PHOTO_FAILED)
    })
})
