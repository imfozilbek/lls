import { describe, expect, it } from "vitest"

import { supportStartLink } from "./write-shop.js"

describe("«Do'konga xabar yozish»", () => {
    it("opens the shop's bot on what the question is about", () => {
        expect(supportStartLink("abc_bolajon_bot", { orderId: "ord-1" })).toBe(
            "https://t.me/abc_bolajon_bot?start=q_oord-1",
        )
        expect(supportStartLink("abc_bolajon_bot", { productId: "prod-7" })).toBe(
            "https://t.me/abc_bolajon_bot?start=q_pprod-7",
        )
    })
})
