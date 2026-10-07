import { PaymentStatus } from "@zumda/core"
import { describe, expect, it } from "vitest"

import { staffUz } from "../i18n/staff.js"
import { uz as base } from "../i18n/uz.js"

import { paymentWarnings } from "./PaymentCheck.js"

import type { Dictionary } from "../i18n/uz.js"
import type { OrderDTO } from "@zumda/core"

const uz = { ...base, ...staffUz } as Dictionary

function order(payment: Partial<OrderDTO["payment"]>): OrderDTO {
    return {
        payment: { status: PaymentStatus.AWAITING, rejections: 0, ...payment },
    } as OrderDTO
}

const AT = "2026-10-03T10:00:00.000Z"

describe("what makes the owner look twice before «Pul keldi»", () => {
    it("a clean screenshot: nothing to say", () => {
        const clean = order({ receipt: { at: AT, customerRejections: 0 } })
        expect(paymentWarnings(clean, uz)).toEqual([])
    })

    it("no «O'tkazdim» yet: the customer never said they paid", () => {
        expect(paymentWarnings(order({ status: PaymentStatus.UNPAID }), uz)).toEqual([
            uz.owner.check.noReceipt,
        ])
    })

    it("the same screenshot before, here or in another shop; transfers never found", () => {
        const here = order({
            receipt: { at: AT, reusedFrom: 12, customerRejections: 1 },
            rejections: 1,
        })
        expect(paymentWarnings(here, uz)).toEqual([
            "Bu chek avval #12 buyurtmada yuborilgan.",
            "Bu mijozning 2 ta o'tkazmasi avval topilmagan.",
        ])
        const elsewhere = order({ receipt: { at: AT, reusedFrom: 0, customerRejections: 0 } })
        expect(paymentWarnings(elsewhere, uz)).toEqual([uz.owner.check.reusedElsewhere])
    })
})
