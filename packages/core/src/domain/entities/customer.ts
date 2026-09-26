import { requireText } from "../shared/guards.js"

import type { Language } from "../enums/language.js"
import type { Phone } from "../value-objects/phone.js"
import type { TelegramId } from "../value-objects/telegram-id.js"

const NAME_MAX = 100

export interface CustomerProps {
    id: string
    telegramId: TelegramId
    name: string
    phone?: Phone
    language: Language
    createdAt: Date
    updatedAt: Date
}

export interface RegisterCustomerInput {
    id: string
    telegramId: TelegramId
    name: string
    language: Language
}

export class Customer {
    private constructor(private props: CustomerProps) {}

    static register(input: RegisterCustomerInput): Customer {
        const now = new Date()
        return new Customer({
            id: input.id,
            telegramId: input.telegramId,
            name: requireText("name", input.name, NAME_MAX),
            language: input.language,
            createdAt: now,
            updatedAt: now,
        })
    }

    static reconstitute(props: CustomerProps): Customer {
        return new Customer({ ...props })
    }

    get id(): string {
        return this.props.id
    }
    get telegramId(): TelegramId {
        return this.props.telegramId
    }
    get name(): string {
        return this.props.name
    }
    get phone(): Phone | undefined {
        return this.props.phone
    }
    get language(): Language {
        return this.props.language
    }
    get createdAt(): Date {
        return this.props.createdAt
    }
    get updatedAt(): Date {
        return this.props.updatedAt
    }

    hasPhone(): boolean {
        return this.props.phone !== undefined
    }

    rename(name: string): void {
        this.props.name = requireText("name", name, NAME_MAX)
        this.touch()
    }

    setPhone(phone: Phone): void {
        this.props.phone = phone
        this.touch()
    }

    setLanguage(language: Language): void {
        this.props.language = language
        this.touch()
    }

    private touch(): void {
        this.props.updatedAt = new Date()
    }
}
