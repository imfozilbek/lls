import { describe, expect, it } from "vitest"

import { kindsHint } from "./kinds-hint.js"

describe("kindsHint", () => {
    it("a counted kind opens as many rows («6 xil», «4xil», «2xili»)", () => {
        expect(kindsHint('"Nemo va uning döstlari" töplami donasi 11ming(6 xil).')).toEqual({
            group: "kind",
            count: 6,
        })
        expect(kindsHint("Weather/ season posterlarimiz 4xil:")).toEqual({
            group: "kind",
            count: 4,
        })
        expect(kindsHint("“Tyulen va ayiqcha shaklidagi suv o'yinchoqlari” 2xili sotuvda")).toEqual(
            { group: "kind", count: 2 },
        )
    })

    it("kinds without a number, and a number past the limit, open two rows", () => {
        expect(kindsHint("Knopka pazl har xilidan .")).toEqual({ group: "kind" })
        expect(kindsHint("Turli mashinachalar")).toEqual({ group: "kind" })
        expect(kindsHint("Kartalar 24 xil")).toEqual({ group: "kind" })
    })

    it("colours to pick, never a colourful toy", () => {
        expect(kindsHint('Yoqimli "hello shapka".Yashil va xaki ranglarda.')).toEqual({
            group: "colour",
        })
        expect(kindsHint("Rang-barang quvnoq mashinachalar.")).toBeNull()
        expect(kindsHint("Rangli halqali rivojlantiruvchi piramida.")).toBeNull()
    })

    it("a size as the last word, whatever the apostrophe", () => {
        expect(kindsHint("Pizza Pepperoni ( katta )")).toEqual({ group: "size" })
        expect(kindsHint("Pizza Go’sht ( o’rta )")).toEqual({ group: "size" })
        expect(kindsHint("Lavash kichkina")).toEqual({ group: "size" })
        expect(kindsHint("KICHIK QUTQARUVCHILAR UCHUN AJOYIB O'YIN! Puzzle.")).toBeNull()
    })

    it("a plain name says nothing", () => {
        for (const name of ["Osh", "Latte", "Coca cola 1,5 l", "Bish tekis", "Turnik"]) {
            expect(kindsHint(name)).toBeNull()
        }
    })
})
