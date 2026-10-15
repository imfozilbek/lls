import { PaymentMethod } from "@zumda/core"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
    clearDraft,
    loadAddress,
    loadDraft,
    loadShowcaseOrder,
    rememberFromOrder,
    saveAddress,
    saveDraft,
    saveShowcaseOrder,
} from "./address-book.js"

function memoryStorage(): Storage {
    const data = new Map<string, string>()
    return {
        get length(): number {
            return data.size
        },
        clear: (): void => data.clear(),
        getItem: (key): string | null => data.get(key) ?? null,
        key: (index): string | null => [...data.keys()][index] ?? null,
        removeItem: (key): void => void data.delete(key),
        setItem: (key, value): void => void data.set(key, value),
    }
}

const PIN = { latitude: 38.97, longitude: 66.68 }

describe("the checkout's memory on this phone", () => {
    beforeEach(() => {
        vi.stubGlobal("localStorage", memoryStorage())
    })

    it("a draft per shop survives «Back» and goes once the order is placed", () => {
        expect(loadDraft("osh")).toBeNull()
        const draft = {
            address: "Navoiy 12",
            landmark: "",
            comment: "3-qavat",
            location: PIN,
            bottlesReturned: 0,
        }
        saveDraft("osh", draft)
        expect(loadDraft("osh")).toEqual(draft)
        expect(loadDraft("suv")).toBeNull()
        clearDraft("osh")
        expect(loadDraft("osh")).toBeNull()
    })

    it("remembers the way of paying with the address", () => {
        saveAddress({
            address: "Navoiy 12",
            landmark: "",
            location: null,
            bottlesReturned: 0,
            paymentMethod: PaymentMethod.CASH,
        })
        expect(loadAddress().paymentMethod).toBe(PaymentMethod.CASH)
    })

    it("a new phone takes the newest order's place, never over one it keeps", () => {
        rememberFromOrder({ address: "Navoiy 12", landmark: "bozor yonida", location: PIN })
        expect(loadAddress()).toMatchObject({
            address: "Navoiy 12",
            landmark: "bozor yonida",
            location: PIN,
        })
        rememberFromOrder({ address: "Boshqa joy", landmark: undefined, location: undefined })
        expect(loadAddress().address).toBe("Navoiy 12")
    })

    it("ignores broken storage", () => {
        localStorage.setItem("zumda:address", "not json")
        expect(loadAddress()).toEqual({
            address: "",
            landmark: "",
            location: null,
            bottlesReturned: 0,
        })
        localStorage.setItem("zumda:checkout-draft:osh", '{"location":{"latitude":"x"}}')
        expect(loadDraft("osh")?.location).toBeNull()
    })

    it("leads back to a showcase order for the day, then lets it go", () => {
        const at = Date.parse("2026-10-15T09:00:00Z")
        saveShowcaseOrder({ slug: "osh", shopName: "Osh Markaz", id: "o1", number: 12, at })
        expect(loadShowcaseOrder(at + 60_000)).toMatchObject({ slug: "osh", number: 12 })
        expect(loadShowcaseOrder(at + 13 * 60 * 60 * 1000)).toBeNull()
    })
})
