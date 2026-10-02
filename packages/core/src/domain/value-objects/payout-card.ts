import { ValidationError } from "../errors/validation.error.js"

const CARD_DIGITS = 16
const HOLDER_MAX = 60
const DIGITS = /^\d+$/

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

    /** "8600 1234 5678 9012": easy to read and to copy. */
    formatted(): string {
        return this.number.replace(/(\d{4})(?=\d)/g, "$1 ")
    }
}
