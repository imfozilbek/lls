const UZ_PHONE_REGEX = /^\+998\d{9}$/

export class Phone {
    private constructor(public readonly number: string) {
        if (!UZ_PHONE_REGEX.test(number)) {
            throw new Error("Invalid phone number format. Expected: +998XXXXXXXXX")
        }
    }

    static create(number: string): Phone {
        const cleaned = number.replace(/\s/g, "")
        return new Phone(cleaned)
    }

    static isValid(number: string): boolean {
        const cleaned = number.replace(/\s/g, "")
        return UZ_PHONE_REGEX.test(cleaned)
    }

    format(): string {
        const digits = this.number.slice(4)
        return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`
    }

    equals(other: Phone): boolean {
        return this.number === other.number
    }
}
