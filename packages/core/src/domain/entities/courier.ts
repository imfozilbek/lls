import { Phone } from "../value-objects/phone.js"
import { TelegramId } from "../value-objects/telegram-id.js"

export interface CourierProps {
    id: string
    telegramId: TelegramId
    name: string
    phone: Phone
    isAvailable: boolean
    isActive: boolean
    createdAt: Date
    updatedAt: Date
}

export class Courier {
    private constructor(private props: CourierProps) {}

    static create(
        props: Omit<CourierProps, "createdAt" | "updatedAt" | "isAvailable" | "isActive">,
    ): Courier {
        const now = new Date()
        return new Courier({
            ...props,
            isAvailable: true,
            isActive: true,
            createdAt: now,
            updatedAt: now,
        })
    }

    static reconstitute(props: CourierProps): Courier {
        return new Courier(props)
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

    get isAvailable(): boolean {
        return this.props.isAvailable
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

    updateProfile(name: string, phone: Phone): void {
        if (!name.trim()) {
            throw new Error("Courier name is required")
        }
        this.props.name = name.trim()
        this.props.phone = phone
        this.props.updatedAt = new Date()
    }

    goOnline(): void {
        this.props.isAvailable = true
        this.props.updatedAt = new Date()
    }

    goOffline(): void {
        this.props.isAvailable = false
        this.props.updatedAt = new Date()
    }

    activate(): void {
        this.props.isActive = true
        this.props.updatedAt = new Date()
    }

    deactivate(): void {
        this.props.isActive = false
        this.props.isAvailable = false
        this.props.updatedAt = new Date()
    }

    canTakeOrder(): boolean {
        return this.props.isActive && this.props.isAvailable
    }

    toJSON(): CourierProps {
        return { ...this.props }
    }
}
