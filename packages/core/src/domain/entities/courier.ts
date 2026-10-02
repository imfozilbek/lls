import { CourierStatus } from "../enums/courier-status.js"
import { BusinessRuleViolationError } from "../errors/business-rule.error.js"
import { ConflictError } from "../errors/conflict.error.js"
import { ValidationError } from "../errors/validation.error.js"
import { addDays, startOfLocalDay, toLocalTime } from "../shared/time.js"
import { WEEKDAYS } from "../value-objects/working-hours.js"

import type { CourierProfile } from "./courier-profile.js"
import type { Phone } from "../value-objects/phone.js"
import type { TelegramId } from "../value-objects/telegram-id.js"
import type { Weekday } from "../value-objects/working-hours.js"

/** An invite link works for two days, then the owner makes a new one. */
export const COURIER_INVITE_TTL_MS = 48 * 60 * 60 * 1000

/** Why a courier cannot take an order right now: the owner sees it next to the name. */
export type CourierUnavailableReason = "not_approved" | "day_off" | "off_today" | "not_on_shift"

/** Why a courier cannot take a district network order now. */
export type NetworkUnavailableReason = "not_approved" | "not_in_network" | "not_on_shift" | "busy"

export interface CourierProps {
    id: string
    businessId: string
    profile: CourierProfile
    status: CourierStatus
    /** Days of the week this courier works for this shop (the owner's choice). */
    workDays: Weekday[]
    /** "Сегодня не работает" until this moment (the end of that local day). */
    offUntil?: Date
    createdAt: Date
    updatedAt: Date
}

/**
 * A courier's work for ONE shop: the link between a person (`CourierProfile`, one per Telegram
 * account) and a shop. The same person may work for several shops: one link per shop. Orders and
 * cash refer to the link, so every shop's money stays separate.
 */
export class Courier {
    private constructor(private props: CourierProps) {}

    /** A network courier took an order of a shop they do not work for: the link holds it. */
    static forNetwork(input: {
        id: string
        businessId: string
        profile: CourierProfile
        now: Date
    }): Courier {
        return new Courier({
            id: input.id,
            businessId: input.businessId,
            profile: input.profile,
            status: CourierStatus.NETWORK,
            workDays: [...WEEKDAYS],
            createdAt: input.now,
            updatedAt: input.now,
        })
    }

    /** The person accepted the shop's invite; the owner still has to approve. */
    static join(input: {
        id: string
        businessId: string
        profile: CourierProfile
        now: Date
    }): Courier {
        return new Courier({
            id: input.id,
            businessId: input.businessId,
            profile: input.profile,
            status: CourierStatus.PENDING,
            workDays: [...WEEKDAYS],
            createdAt: input.now,
            updatedAt: input.now,
        })
    }

    static reconstitute(props: CourierProps): Courier {
        return new Courier({ ...props, workDays: [...props.workDays] })
    }

    get id(): string {
        return this.props.id
    }
    get businessId(): string {
        return this.props.businessId
    }
    get profile(): CourierProfile {
        return this.props.profile
    }
    get telegramId(): TelegramId {
        return this.props.profile.telegramId
    }
    get name(): string {
        return this.props.profile.name
    }
    get phone(): Phone | undefined {
        return this.props.profile.phone
    }
    get status(): CourierStatus {
        return this.props.status
    }
    get isActive(): boolean {
        return this.props.status === CourierStatus.ACTIVE
    }
    get isPending(): boolean {
        return this.props.status === CourierStatus.PENDING
    }
    /** Took this shop's orders from the district network; not the shop's own courier. */
    get isNetwork(): boolean {
        return this.props.status === CourierStatus.NETWORK
    }
    get workDays(): readonly Weekday[] {
        return this.props.workDays
    }
    get offUntil(): Date | undefined {
        return this.props.offUntil
    }
    get createdAt(): Date {
        return this.props.createdAt
    }
    get updatedAt(): Date {
        return this.props.updatedAt
    }

    /** An approved courier of this shop: may see its orders and hold its cash. */
    worksFor(businessId: string): boolean {
        return this.isActive && this.props.businessId === businessId
    }

    /** May move this shop's orders assigned to them: its own courier, or a network one. */
    deliversFor(businessId: string): boolean {
        return (this.isActive || this.isNetwork) && this.props.businessId === businessId
    }

    /** A new invite of the same shop: a removed courier asks again; an active one stays. */
    rejoin(now: Date): void {
        if (this.isActive) {
            return
        }
        this.props.status = CourierStatus.PENDING
        this.props.updatedAt = now
    }

    approve(now: Date): void {
        this.review(CourierStatus.ACTIVE, now)
    }

    decline(now: Date): void {
        this.review(CourierStatus.REMOVED, now)
    }

    private review(to: CourierStatus, now: Date): void {
        if (!this.isPending) {
            throw ConflictError.courierAlreadyReviewed(this.props.id)
        }
        this.props.status = to
        this.props.updatedAt = now
    }

    deactivate(now: Date): void {
        this.props.status = CourierStatus.REMOVED
        this.props.updatedAt = now
    }

    /** The owner's week for this courier: at least one day, each day once, Monday first. */
    setWorkDays(days: readonly string[], now: Date): void {
        const chosen = WEEKDAYS.filter((day) => days.includes(day))
        const unique = new Set(days).size === days.length
        if (chosen.length === 0 || !unique || chosen.length !== days.length) {
            throw ValidationError.fromField("workDays", "Pick one or more weekdays", days)
        }
        this.props.workDays = chosen
        this.props.updatedAt = now
    }

    /** "Сегодня не работает": until the end of today, like a stop-list item. */
    setOffToday(off: boolean, now: Date): void {
        this.props.offUntil = off ? addDays(startOfLocalDay(now), 1) : undefined
        this.props.updatedAt = now
    }

    isOffToday(now: Date): boolean {
        return this.props.offUntil !== undefined && now < this.props.offUntil
    }

    /** Why this courier cannot take a new order now, or null when they can. */
    unavailableReason(now: Date): CourierUnavailableReason | null {
        if (!this.isActive) {
            return "not_approved"
        }
        const today = WEEKDAYS[toLocalTime(now).weekday]
        if (!today || !this.props.workDays.includes(today)) {
            return "day_off"
        }
        if (this.isOffToday(now)) {
            return "off_today"
        }
        return this.props.profile.isOnShift(now) ? null : "not_on_shift"
    }

    /** Approved, a working day, not switched off for today (the shift is the courier's part). */
    worksToday(now: Date): boolean {
        const reason = this.unavailableReason(now)
        return reason === null || reason === "not_on_shift"
    }

    /** Working for this shop today, and on shift: may be given a new order. */
    isAvailable(now: Date): boolean {
        return this.unavailableReason(now) === null
    }
}

export interface CourierInviteProps {
    code: string
    businessId: string
    createdAt: Date
    expiresAt: Date
    usedAt?: Date
}

/**
 * One-time link `t.me/<courier_bot>?start=c_<code>`: whoever opens it asks to become a courier of
 * the shop; the owner approves.
 */
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
