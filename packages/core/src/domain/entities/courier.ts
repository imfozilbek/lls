import { BusinessRuleViolationError } from "../errors/business-rule.error.js"
import { requireText } from "../shared/guards.js"

import type { Phone } from "../value-objects/phone.js"
import type { TelegramId } from "../value-objects/telegram-id.js"

const NAME_MAX = 80
/** An invite link works for two days, then the owner makes a new one. */
export const COURIER_INVITE_TTL_MS = 48 * 60 * 60 * 1000

export interface CourierProps {
    id: string
    businessId: string
    telegramId: TelegramId
    name: string
    phone?: Phone
    isActive: boolean
    createdAt: Date
    updatedAt: Date
}

/**
 * A delivery person of ONE shop. Stage 3 adds a shared pool on top; this record stays per shop.
 * The same person may work for several shops: one record per shop.
 */
export class Courier {
    private constructor(private props: CourierProps) {}

    static join(input: {
        id: string
        businessId: string
        telegramId: TelegramId
        name: string
        now: Date
    }): Courier {
        return new Courier({
            id: input.id,
            businessId: input.businessId,
            telegramId: input.telegramId,
            name: requireText("name", input.name, NAME_MAX),
            isActive: true,
            createdAt: input.now,
            updatedAt: input.now,
        })
    }

    static reconstitute(props: CourierProps): Courier {
        return new Courier({ ...props })
    }

    get id(): string {
        return this.props.id
    }
    get businessId(): string {
        return this.props.businessId
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
    get isActive(): boolean {
        return this.props.isActive
    }
    get createdAt(): Date {
        return this.props.createdAt
    }
    get updatedAt(): Date {
        return this.props.updatedAt
    }

    worksFor(businessId: string): boolean {
        return this.props.isActive && this.props.businessId === businessId
    }

    /** Joining again with a new invite brings a deactivated courier back. */
    rejoin(name: string, now: Date): void {
        this.props.name = requireText("name", name, NAME_MAX)
        this.props.isActive = true
        this.props.updatedAt = now
    }

    deactivate(now: Date): void {
        this.props.isActive = false
        this.props.updatedAt = now
    }

    setPhone(phone: Phone, now: Date): void {
        this.props.phone = phone
        this.props.updatedAt = now
    }
}

export interface CourierInviteProps {
    code: string
    businessId: string
    createdAt: Date
    expiresAt: Date
    usedAt?: Date
}

/** One-time link `t.me/<shop_bot>?start=c_<code>` that turns whoever opens it into a courier. */
export class CourierInvite {
    private constructor(private props: CourierInviteProps) {}

    static create(input: { code: string; businessId: string; now: Date }): CourierInvite {
        return new CourierInvite({
            code: input.code,
            businessId: input.businessId,
            createdAt: input.now,
            expiresAt: new Date(input.now.getTime() + COURIER_INVITE_TTL_MS),
        })
    }

    static reconstitute(props: CourierInviteProps): CourierInvite {
        return new CourierInvite({ ...props })
    }

    get code(): string {
        return this.props.code
    }
    get businessId(): string {
        return this.props.businessId
    }
    get createdAt(): Date {
        return this.props.createdAt
    }
    get expiresAt(): Date {
        return this.props.expiresAt
    }
    get usedAt(): Date | undefined {
        return this.props.usedAt
    }

    /** Marks the invite used. Throws if it was used before or has expired. */
    use(now: Date): void {
        if (this.props.usedAt) {
            throw BusinessRuleViolationError.inviteUsed()
        }
        if (now >= this.props.expiresAt) {
            throw BusinessRuleViolationError.inviteExpired()
        }
        this.props.usedAt = now
    }
}
