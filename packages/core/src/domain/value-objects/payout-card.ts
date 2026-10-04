import { ValidationError } from "../errors/validation.error.js"

const CARD_DIGITS = 16
const HOLDER_MAX = 60
const DIGITS = /^\d+$/

/** The card systems Zumda recognizes by a number's first digits; any other card is still taken. */
export enum CardSystem {
    HUMO = "humo",
    UZCARD = "uzcard",
    VISA = "visa",
    MASTERCARD = "mastercard",
    UNIONPAY = "unionpay",
    MIR = "mir",
}

/** First digits → system, the narrow ranges before the wide ones. */
const SYSTEM_RANGES: readonly { from: number; to: number; digits: number; system: CardSystem }[] = [
    { from: 9860, to: 9860, digits: 4, system: CardSystem.HUMO },
    { from: 8600, to: 8600, digits: 4, system: CardSystem.UZCARD },
    // Uzcard cards co-badged with Mastercard.
    { from: 5614, to: 5614, digits: 4, system: CardSystem.UZCARD },
    { from: 2200, to: 2204, digits: 4, system: CardSystem.MIR },
    { from: 2221, to: 2720, digits: 4, system: CardSystem.MASTERCARD },
    { from: 51, to: 55, digits: 2, system: CardSystem.MASTERCARD },
    { from: 62, to: 62, digits: 2, system: CardSystem.UNIONPAY },
    { from: 4, to: 4, digits: 1, system: CardSystem.VISA },
]

/**
 * The card's system by its first digits (spaces and dashes ignored), already while it is typed;
 * `null` while too short to tell, or for a card Zumda does not know (it is still accepted).
 */
export function cardSystemOf(rawNumber: string): CardSystem | null {
    const number = rawNumber.replace(/[\s-]/g, "")
    if (!DIGITS.test(number)) {
        return null
    }
    const range = SYSTEM_RANGES.find((r) => {
        if (number.length < r.digits) {
            return false
        }
        const head = Number(number.slice(0, r.digits))
        return head >= r.from && head <= r.to
    })
    return range?.system ?? null
}

/** The Luhn check every bank card number passes; catches a mistyped digit. */
function passesLuhn(digits: string): boolean {
    let sum = 0
    for (let i = 0; i < digits.length; i++) {
        let digit = Number(digits[digits.length - 1 - i])
        if (i % 2 === 1) {
            digit *= 2
            if (digit > 9) {
                digit -= 9
            }
        }
        sum += digit
    }
    return sum % 10 === 0
}

/**
 * The shop's card for customers' transfers (Uzcard, Humo, Visa…). Not a secret: it is shown to
 * the customer who chooses to pay by transfer.
 */
export class PayoutCard {
    private constructor(
        public readonly number: string,
        public readonly holder: string,
    ) {}

    /** Accepts "8600 1234 5678 9012" with any spaces or dashes. */
    static create(rawNumber: string, rawHolder: string): PayoutCard {
        const number = rawNumber.replace(/[\s-]/g, "")
        if (number.length !== CARD_DIGITS || !DIGITS.test(number) || !passesLuhn(number)) {
            throw ValidationError.fromField("cardNumber", "Not a valid card number", rawNumber)
        }
        const holder = rawHolder.trim().replace(/\s+/g, " ")
        if (holder.length === 0 || holder.length > HOLDER_MAX) {
            throw ValidationError.fromField("cardHolder", "Name on the card is required", rawHolder)
        }
        return new PayoutCard(number, holder)
    }

    /** Humo, Uzcard, Visa…; `null` for a card Zumda does not recognize. */
    get system(): CardSystem | null {
        return cardSystemOf(this.number)
    }

    /** "8600 1234 5678 9012": easy to read and to copy. */
    formatted(): string {
        return this.number.replace(/(\d{4})(?=\d)/g, "$1 ")
    }
}
