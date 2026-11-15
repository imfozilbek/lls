import { describe, expect, it } from "vitest"

import { addressComplete } from "./checkout-address.js"

import type { Draft } from "../lib/address-book.js"
import type { Shop } from "../stores/session.js"

const YAKKABOG = { latitude: 38.9785, longitude: 66.6831 }

function draft(fields: Partial<Draft>): Draft {
    return { address: "", landmark: "", comment: "", location: null, bottlesReturned: 0, ...fields }
}

function shop(radiusMeters?: number): Shop {
    return { location: YAKKABOG, delivery: { fee: 0, radiusMeters } } as unknown as Shop
}

describe("the place at checkout", () => {
    it("every order carries the pin, in a shop without a radius too", () => {
        expect(addressComplete(draft({ address: "Navoiy 12" }), shop())).toBe(false)
        expect(addressComplete(draft({ address: "Navoiy 12", location: YAKKABOG }), shop())).toBe(
            true,
        )
    })

    it("with the pin a landmark names the place; without both, it is not enough", () => {
        expect(addressComplete(draft({ landmark: "Bozor", location: YAKKABOG }), shop())).toBe(true)
        expect(addressComplete(draft({ location: YAKKABOG }), shop())).toBe(false)
    })

    it("a pin beyond the shop's radius is refused", () => {
        const far = { latitude: 39.6, longitude: 66.9 }
        expect(addressComplete(draft({ address: "Navoiy 12", location: far }), shop(3_000))).toBe(
            false,
        )
    })
})
