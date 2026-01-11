import { Address } from "../value-objects/address.js"
import { Phone } from "../value-objects/phone.js"
import { TelegramId } from "../value-objects/telegram-id.js"

export interface CustomerProps {
    id: string
    telegramId: TelegramId
    name: string
    phone: Phone
    address: Address
    createdAt: Date
    updatedAt: Date
}

export class Customer {
    private constructor(private props: CustomerProps) {}

    static create(props: Omit<CustomerProps, "createdAt" | "updatedAt">): Customer {
        const now = new Date()
        return new Customer({
            ...props,
            createdAt: now,
            updatedAt: now,
        })
    }

    static reconstitute(props: CustomerProps): Customer {
        return new Customer(props)
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

    get phone(): Phone {
        return this.props.phone
    }

    get address(): Address {
        return this.props.address
    }

    get createdAt(): Date {
        return this.props.createdAt
    }

    get updatedAt(): Date {
        return this.props.updatedAt
    }

    updateProfile(name: string, phone: Phone): void {
        if (!name.trim()) {
            throw new Error("Customer name is required")
        }
        this.props.name = name.trim()
        this.props.phone = phone
        this.props.updatedAt = new Date()
    }

    updateAddress(address: Address): void {
        this.props.address = address
        this.props.updatedAt = new Date()
    }

    toJSON(): CustomerProps {
        return { ...this.props }
    }
}
