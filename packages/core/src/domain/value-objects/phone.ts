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
}

/** "+998901234567" → "+998 90 123 45 67". Other countries stay in E.164 form. */
export function formatPhone(e164: string): string {
    if (!e164.startsWith(`+${UZ_COUNTRY_CODE}`) || e164.length !== 13) {
        return e164
    }
    const d = e164.slice(4)
    return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`
}
