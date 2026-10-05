import { describe, expect, it } from "vitest"

import { ZUMDA_SHOP_BOT, shopBotLink, zumdaShopLink } from "./poster.js"

describe("poster links", () => {
    it("the shop's bot, or Zumda Shop opening right on the shop", () => {
        expect(shopBotLink("osh_markaz_bot")).toBe("https://t.me/osh_markaz_bot")
        expect(ZUMDA_SHOP_BOT).toBe("zumdashop_bot")
        expect(zumdaShopLink("osh-markaz")).toBe("https://t.me/zumdashop_bot?startapp=m_osh-markaz")
        // Telegram takes 64 characters of [A-Za-z0-9_-] in startapp: the longest slug fits.
        expect(`m_${"a".repeat(40)}`.length).toBeLessThanOrEqual(64)
    })
})
