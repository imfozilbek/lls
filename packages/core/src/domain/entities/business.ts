import { BusinessType } from "../enums/business-type.js"
import { Address } from "../value-objects/address.js"
import { TelegramId } from "../value-objects/telegram-id.js"

export interface BusinessProps {
    id: string
    name: string
    type: BusinessType
    address: Address
    telegramId: TelegramId
    isActive: boolean
    createdAt: Date
    updatedAt: Date
}

export class Business {
    private constructor(private props: BusinessProps) {}

    static create(props: Omit<BusinessProps, "createdAt" | "updatedAt" | "isActive">): Business {
        const now = new Date()
        return new Business({
            ...props,
            isActive: true,
            createdAt: now,
            updatedAt: now,
        })
    }

    static reconstitute(props: BusinessProps): Business {
        return new Business(props)
    }

    get id(): string {
        return this.props.id
    }

    get name(): string {
        return this.props.name
    }

    get type(): BusinessType {
        return this.props.type
    }

    get address(): Address {
        return this.props.address
    }

    get telegramId(): TelegramId {
        return this.props.telegramId
    }

    get isActive(): boolean {
        return this.props.isActive
    }

    get createdAt(): Date {
        return this.props.createdAt
    }

    get updatedAt(): Date {
        return this.props.updatedAt
    }

    updateName(name: string): void {
        if (!name.trim()) {
            throw new Error("Business name is required")
        }
        this.props.name = name.trim()
        this.props.updatedAt = new Date()
    }

    updateAddress(address: Address): void {
        this.props.address = address
        this.props.updatedAt = new Date()
    }

    activate(): void {
        this.props.isActive = true
        this.props.updatedAt = new Date()
    }

    deactivate(): void {
        this.props.isActive = false
        this.props.updatedAt = new Date()
    }

    toJSON(): BusinessProps {
        return { ...this.props }
    }
}
