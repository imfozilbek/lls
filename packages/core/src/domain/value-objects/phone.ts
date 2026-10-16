import { ValidationError } from "../errors/validation.error.js"

const E164_DIGITS = /^\d{8,15}$/
const STORED_E164 = /^\+\d{8,15}$/
/** No country code starts with 0: «0 90 123 45 67» is a mistyped number, not a foreign one. */
const NO_COUNTRY = "0"
const UZ_COUNTRY_CODE = "998"
const UZ_LOCAL_LENGTH = 9
/** The old way to dial a Uzbek number inside the country: «8 90 123 45 67». */
const UZ_TRUNK_PREFIX = "8"

/** Phone number in E.164 form, e.g. "+998901234567". */
export class Phone {
    private constructor(public readonly number: string) {}

    /**
     * A number a person typed or Telegram sent: "+998 90 123-45-67", "998901234567" (Telegram
     * contact), "901234567" and the old "8 90 123 45 67". A Uzbek number has exactly 9 digits
     * after 998: a missed digit would put a number nobody answers on the storefront. With «+»
     * the digits are taken as they are (a foreign number keeps its own country).
     */
    static create(raw: string): Phone {
        let digits = raw.replace(/\D/g, "")
        const international = raw.trim().startsWith("+")
        if (!international && digits.length === UZ_LOCAL_LENGTH) {
            digits = UZ_COUNTRY_CODE + digits
        } else if (
            !international &&
            digits.length === UZ_LOCAL_LENGTH + 1 &&
            digits.startsWith(UZ_TRUNK_PREFIX)
        ) {
            digits = UZ_COUNTRY_CODE + digits.slice(1)
        }
        const uzbekWrongLength =
            digits.startsWith(UZ_COUNTRY_CODE) &&
            digits.length !== UZ_COUNTRY_CODE.length + UZ_LOCAL_LENGTH
        if (!E164_DIGITS.test(digits) || digits.startsWith(NO_COUNTRY) || uzbekWrongLength) {
            throw ValidationError.fromField("phone", "Invalid phone number", raw)
        }
        return new Phone(`+${digits}`)
    }

    /**
     * A number Zumda saved earlier, read back as it is. The rules for typing one grew stricter
     * (October 2026); a row saved before must still read, or one shop's old number would break
     * the shop and every list it is in (the showcase, «Platforma», the district).
     */
    static fromStored(e164: string): Phone {
        if (!STORED_E164.test(e164)) {
            throw ValidationError.fromField("phone", "Invalid stored phone number", e164)
        }
        return new Phone(e164)
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
