import { optionalText, requireText } from "../shared/guards.js"
import { addDays, startOfLocalDay } from "../shared/time.js"

import type { Phone } from "../value-objects/phone.js"
import type { TelegramId } from "../value-objects/telegram-id.js"

const NAME_MAX = 80
const VEHICLE_MAX = 40

export interface CourierProfileProps {
    telegramId: TelegramId
    name: string
    phone?: Phone
    /** "Damas", "Nexia", "moto": what the courier drives. */
    vehicle?: string
    /** On shift until this moment: the end of the local day the shift started. */
    shiftUntil?: Date
    createdAt: Date
    updatedAt: Date
}

/**
 * One delivery person, whatever shops they work for: the profile in the LLS courier bot.
 * Their work for each shop is a separate `Courier` link.
 */
export class CourierProfile {
    private constructor(private props: CourierProfileProps) {}

    static create(input: { telegramId: TelegramId; name: string; now: Date }): CourierProfile {
        return new CourierProfile({
            telegramId: input.telegramId,
            name: requireText("name", input.name, NAME_MAX),
            createdAt: input.now,
            updatedAt: input.now,
        })
    }

    static reconstitute(props: CourierProfileProps): CourierProfile {
        return new CourierProfile({ ...props })
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
    get vehicle(): string | undefined {
        return this.props.vehicle
    }
    get shiftUntil(): Date | undefined {
        return this.props.shiftUntil
    }
    get createdAt(): Date {
        return this.props.createdAt
    }
    get updatedAt(): Date {
        return this.props.updatedAt
    }

    setPhone(phone: Phone, now: Date): void {
        this.props.phone = phone
        this.props.updatedAt = now
    }

    setVehicle(vehicle: string | null, now: Date): void {
        this.props.vehicle = optionalText("vehicle", vehicle, VEHICLE_MAX)
        this.props.updatedAt = now
    }

    /** "Я на смене": for today only, so a forgotten shift never carries over to tomorrow. */
    startShift(now: Date): void {
        this.props.shiftUntil = addDays(startOfLocalDay(now), 1)
        this.props.updatedAt = now
    }

    endShift(now: Date): void {
        this.props.shiftUntil = undefined
        this.props.updatedAt = now
    }

    isOnShift(now: Date): boolean {
        return this.props.shiftUntil !== undefined && now < this.props.shiftUntil
    }
}
