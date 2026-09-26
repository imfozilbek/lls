import { ValidationError } from "../errors/validation.error.js"

const E164_DIGITS = /^\d{8,15}$/
const UZ_COUNTRY_CODE = "998"
const UZ_LOCAL_LENGTH = 9

/** Phone number in E.164 form, e.g. "+998901234567". */
export class Phone {
    private constructor(public readonly number: string) {}

    /** Accepts "+998 90 123-45-67", "998901234567" (Telegram contact) or "901234567". */
    static create(raw: string): Phone {
        let digits = raw.replace(/\D/g, "")
        if (digits.length === UZ_LOCAL_LENGTH) {
            digits = UZ_COUNTRY_CODE + digits
        }
        if (!E164_DIGITS.test(digits)) {
            throw ValidationError.fromField("phone", "Invalid phone number", raw)
        }
        return new Phone(`+${digits}`)
    }

    isUzbek(): boolean {
        return this.number.startsWith(`+${UZ_COUNTRY_CODE}`)
    }

    /** "+998 90 123 45 67" for Uzbek numbers, E.164 otherwise. */
    format(): string {
        if (!this.isUzbek() || this.number.length !== 13) {
            return this.number
        }
        const d = this.number.slice(4)
        return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`
    }

    equals(other: Phone): boolean {
        return this.number === other.number
    }
}
