import { describe, expect, it } from "vitest"

import { CashHandover } from "../../../domain/entities/cash-handover.js"
import { PaidWith, PaymentMethod, PaymentStatus } from "../../../domain/enums/payment.js"
import { BusinessRuleViolationError } from "../../../domain/errors/business-rule.error.js"
import { ValidationError } from "../../../domain/errors/validation.error.js"
import { startOfLocalMonth } from "../../../domain/shared/time.js"
import { Money } from "../../../domain/value-objects/money.js"
import { Payment } from "../../../domain/value-objects/payment.js"
import { PayoutCard } from "../../../domain/value-objects/payout-card.js"

const AT = new Date("2026-10-01T10:00:00Z")
const COURIER = { kind: "courier", courierId: "courier-1" } as const
const OWNER = { kind: "owner" } as const

describe("Payment", () => {
    it("starts unpaid for cash and awaited for a transfer", () => {
        expect(Payment.start(PaymentMethod.CASH).status).toBe(PaymentStatus.UNPAID)
        expect(Payment.start(PaymentMethod.CARD_TRANSFER).status).toBe(PaymentStatus.AWAITING)
    })

    it("cash at the door is paid and held by whoever delivered", () => {
        const byCourier = Payment.start(PaymentMethod.CARD_TRANSFER).settleOnDelivery(
            PaidWith.CASH,
            COURIER,
            AT,
        )
        // The customer changed their mind at the door: the method follows what happened.
        expect(byCourier).toMatchObject({
            method: PaymentMethod.CASH,
            status: PaymentStatus.PAID,
            paidAt: AT,
            cashCourierId: "courier-1",
        })
        const byOwner = Payment.start(PaymentMethod.CASH).settleOnDelivery(PaidWith.CASH, OWNER, AT)
        expect(byOwner.cashCourierId).toBeUndefined()
        expect(byOwner.isPaid()).toBe(true)
    })

    it("a transfer at the door waits for the owner; 'later' is a debt", () => {
        const transfer = Payment.start(PaymentMethod.CASH).settleOnDelivery(
            PaidWith.CARD_TRANSFER,
            COURIER,
            AT,
        )
        expect(transfer).toMatchObject({
            method: PaymentMethod.CARD_TRANSFER,
            status: PaymentStatus.AWAITING,
        })
        expect(transfer.cashCourierId).toBeUndefined()
        const later = Payment.start(PaymentMethod.CASH).settleOnDelivery(PaidWith.LATER, OWNER, AT)
        expect(later.status).toBe(PaymentStatus.UNPAID)
    })

    it("money confirmed before delivery stays as it is", () => {
        const paid = Payment.start(PaymentMethod.CARD_TRANSFER).confirm(
            PaymentMethod.CARD_TRANSFER,
            AT,
            false,
        )
        expect(paid.settleOnDelivery(PaidWith.CASH, COURIER, AT)).toBe(paid)
    })

    it("the owner confirms a transfer or a paid debt; nothing else", () => {
        const debt = Payment.start(PaymentMethod.CASH).settleOnDelivery(PaidWith.LATER, OWNER, AT)
        expect(debt.confirm(PaymentMethod.CASH, AT, false)).toMatchObject({
            status: PaymentStatus.PAID,
            method: PaymentMethod.CASH,
        })
        const paid = debt.confirm(PaymentMethod.CARD_TRANSFER, AT, false)
        expect(() => paid.confirm(PaymentMethod.CASH, AT, false)).toThrow(
            BusinessRuleViolationError,
        )
    })

    it("cancelling: paid money is owed back, an unconfirmed transfer is dropped", () => {
        const paid = Payment.start(PaymentMethod.CARD_TRANSFER).confirm(
            PaymentMethod.CARD_TRANSFER,
            AT,
            false,
        )
        const owed = paid.onCancel()
        expect(owed.status).toBe(PaymentStatus.REFUND_DUE)
        expect(owed.refund().status).toBe(PaymentStatus.REFUNDED)
        expect(() => owed.refund().refund()).toThrow(BusinessRuleViolationError)
        expect(Payment.start(PaymentMethod.CARD_TRANSFER).onCancel().status).toBe(
            PaymentStatus.UNPAID,
        )
        // A transfer that arrives after the cancel is owed back at once.
        expect(
            Payment.start(PaymentMethod.CARD_TRANSFER).confirm(
                PaymentMethod.CARD_TRANSFER,
                AT,
                true,
            ).status,
        ).toBe(PaymentStatus.REFUND_DUE)
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

describe("CashHandover and money helpers", () => {
    const base = { id: "h-1", businessId: "biz-1", courierId: "courier-1", at: AT }

    it("never more than the courier holds, never zero", () => {
        expect(
            CashHandover.record({ ...base, amount: Money.of(50_000), onHand: Money.of(80_000) })
                .amount.amount,
        ).toBe(50_000)
        expect(() =>
            CashHandover.record({ ...base, amount: Money.of(90_000), onHand: Money.of(80_000) }),
        ).toThrow(BusinessRuleViolationError)
        expect(() =>
            CashHandover.record({ ...base, amount: Money.zero(), onHand: Money.of(80_000) }),
        ).toThrow(BusinessRuleViolationError)
    })

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
