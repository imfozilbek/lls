import { describe, expect, it } from "vitest"

import { columnsFor } from "./OptionsPicker.js"

describe("columnsFor", () => {
    it("short names three a row, longer two, long ones a row each", () => {
        expect(columnsFor(["0,3 l", "0,4 l", "0,5 l"])).toBe(3)
        expect(columnsFor(["kichik", "o'rta", "katta"])).toBe(3)
        expect(columnsFor(["Yashil", "Xaki rangda"])).toBe(2)
        expect(columnsFor(["Nemo", "Dori va Nemo, katta to'plam"])).toBe(1)
    })
})
