import { describe, expect, it } from "vitest"

import { PaymentMethod, PaymentStatus } from "../../../domain/enums/payment.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { ValidationError } from "../../../domain/errors/validation.error.js"
import { startOfLocalMonth } from "../../../domain/shared/time.js"
import { Money } from "../../../domain/value-objects/money.js"
import { Payment } from "../../../domain/value-objects/payment.js"
import { PayoutCard } from "../../../domain/value-objects/payout-card.js"

const AT = new Date("2026-10-01T10:00:00Z")
const RECEIPT = { key: "receipts/b/o/1", hash: "h1", at: AT, customerRejections: 0 }

describe("Payment", () => {
    it("always a transfer to the shop's card; nothing has arrived at checkout", () => {
        const payment = Payment.start()
        expect(payment).toMatchObject({
            method: PaymentMethod.CARD_TRANSFER,
            status: PaymentStatus.UNPAID,
        })
        expect(payment.paidAt).toBeUndefined()
        expect(payment.cashCourierId).toBeUndefined()
        expect(payment.isPaid()).toBe(false)
    })

    it("«Я перевёл» asks the owner to look; after the money nothing changes", () => {
        const sent = Payment.start().markSent(RECEIPT)
        expect(sent.status).toBe(PaymentStatus.AWAITING)
        expect(sent.markSent(RECEIPT).status).toBe(PaymentStatus.AWAITING)
        const paid = sent.confirm(AT, false)
        expect(paid.markSent(RECEIPT)).toBe(paid)
    })

    it("the owner confirms an awaited or an unannounced transfer; nothing else", () => {
        expect(Payment.start().markSent(RECEIPT).confirm(AT, false)).toMatchObject({
            status: PaymentStatus.PAID,
            method: PaymentMethod.CARD_TRANSFER,
            paidAt: AT,
        })
        const paid = Payment.start().confirm(AT, false)
        expect(paid.isPaid()).toBe(true)
        expect(() => paid.confirm(AT, false)).toThrow(BusinessRuleViolationError)
    })

    it("cancelling: paid money is owed back, an unconfirmed transfer stays awaited", () => {
        const owed = Payment.start().confirm(AT, false).onCancel()
        expect(owed.status).toBe(PaymentStatus.REFUND_DUE)
        expect(owed.refund().status).toBe(PaymentStatus.REFUNDED)
        expect(() => owed.refund().refund()).toThrow(BusinessRuleViolationError)
        expect(Payment.start().onCancel().status).toBe(PaymentStatus.UNPAID)
        expect(Payment.start().markSent(RECEIPT).onCancel().status).toBe(PaymentStatus.AWAITING)
        // A transfer that arrives after the cancel is owed back at once.
        expect(Payment.start().markSent(RECEIPT).confirm(AT, true).status).toBe(
            PaymentStatus.REFUND_DUE,
        )
    })

    it("keeps the card the customer was shown through every step", () => {
        const card = PayoutCard.create("4111111111111111", "Rustam Karimov")
        const paid = Payment.start(card).markSent(RECEIPT).confirm(AT, false)
        expect(paid.card).toBe(card)
        expect(paid.onCancel().refund().card).toBe(card)
    })

    it("the receipt rides along; a new one replaces it until the money is confirmed", () => {
        const sent = Payment.start().markSent(RECEIPT)
        expect(sent.receipt).toBe(RECEIPT)
        const again = sent.markSent({ ...RECEIPT, key: "receipts/b/o/2", hash: "h2" })
        expect(again.receipt?.hash).toBe("h2")
        const paid = again.confirm(AT, false)
        expect(paid.receipt?.hash).toBe("h2")
        expect(paid.markSent(RECEIPT)).toBe(paid)
    })

    it("«Pul kelmadi»: an awaited transfer goes back to unpaid and is counted", () => {
        const rejected = Payment.start().markSent(RECEIPT).reject()
        expect(rejected.status).toBe(PaymentStatus.UNPAID)
        expect(rejected.rejections).toBe(1)
        expect(rejected.markSent(RECEIPT).reject().rejections).toBe(2)
        // Only a transfer the customer reported can be "not found".
        expect(() => Payment.start().reject()).toThrow(BusinessRuleViolationError)
        expect(() => Payment.start().confirm(AT, false).reject()).toThrow(
            BusinessRuleViolationError,
        )
        expect(rejected.markSent(RECEIPT).confirm(AT, false).rejections).toBe(1)
    })

    it("old cash rows still read", () => {
        const old = Payment.reconstitute({
            method: PaymentMethod.CASH,
            status: PaymentStatus.PAID,
            paidAt: AT,
            cashCourierId: "courier-1",
        })
        expect(old.cashCourierId).toBe("courier-1")
        expect(old.onCancel().status).toBe(PaymentStatus.REFUND_DUE)
    })
})

describe("PayoutCard", () => {
    it("accepts a real card number with spaces and formats it back", () => {
        const card = PayoutCard.create("4111 1111-1111 1111", "  Rustam   Karimov ")
        expect(card.number).toBe("4111111111111111")
        expect(card.holder).toBe("Rustam Karimov")
        expect(card.formatted()).toBe("4111 1111 1111 1111")
    })

    it("rejects a typo, a short number and an empty name", () => {
        expect(() => PayoutCard.create("4111111111111112", "R")).toThrow(ValidationError)
        expect(() => PayoutCard.create("411111111111", "R")).toThrow(ValidationError)
        expect(() => PayoutCard.create("4111111111111111", "  ")).toThrow(ValidationError)
    })
})

describe("money helpers", () => {
    it("Money.subtract never goes below zero", () => {
        expect(Money.of(10).subtract(Money.of(4)).amount).toBe(6)
        expect(() => Money.of(4).subtract(Money.of(10))).toThrow(ValidationError)
    })

    it("the local month starts on the 1st in Tashkent time", () => {
        // 1 October 02:00 in Tashkent is still 30 September in UTC.
        expect(startOfLocalMonth(new Date("2026-09-30T21:00:00Z")).toISOString()).toBe(
            "2026-09-30T19:00:00.000Z",
        )
        expect(startOfLocalMonth(new Date("2026-10-15T12:00:00Z")).toISOString()).toBe(
            "2026-09-30T19:00:00.000Z",
        )
    })
})
