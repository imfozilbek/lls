import { LANGUAGES, SEND_WAYS } from "@zumda/core"
import { describe, expect, it } from "vitest"

import { deliveryWords } from "./delivery-words.js"

describe("the customer's words about the delivery", () => {
    it("every language says every way, in Uzbek (Latin) only", () => {
        for (const language of LANGUAGES) {
            const words = deliveryWords(language)
            for (const way of SEND_WAYS) {
                expect(words.sentVia[way].trim()).not.toBe("")
            }
            const texts = [words.apart, words.apartHint, words.dispatcher, words.callDispatcher]
            for (const text of [...texts, ...Object.values(words.sentVia)]) {
                expect(text).not.toMatch(/[Ѐ-ӿ]/)
            }
            expect(words.dispatcher).toContain("{name}")
        }
    })
})
