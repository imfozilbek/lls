import { requireInteger, requireText } from "../shared/guards.js"

import type { Location } from "../value-objects/location.js"

const NAME_MAX = 60
const MIN_RADIUS_METERS = 1_000
const MAX_RADIUS_METERS = 100_000
/** How long a network order may wait for a courier before the shop and admins hear about it. */
export const DEFAULT_NETWORK_WAIT_MINUTES = 10
const MAX_WAIT_MINUTES = 180
const MS_PER_MINUTE = 60_000

export interface DistrictProps {
    id: string
    name: string
    center: Location
    radiusMeters: number
    waitMinutes: number
    createdAt: Date
    updatedAt: Date
}

/**
 * One district of the delivery network: a circle around its center (20–30 km in practice).
 * A shop belongs to the district its location falls in; its network orders go to the free
 * network couriers of that district.
 */
export class District {
    private constructor(private props: DistrictProps) {}

    static create(input: {
        id: string
        name: string
        center: Location
        radiusMeters: number
        now: Date
    }): District {
        return new District({
            id: input.id,
            name: requireText("name", input.name, NAME_MAX),
            center: input.center,
            radiusMeters: requireInteger(
                "radiusMeters",
                input.radiusMeters,
                MIN_RADIUS_METERS,
                MAX_RADIUS_METERS,
            ),
            waitMinutes: DEFAULT_NETWORK_WAIT_MINUTES,
            createdAt: input.now,
            updatedAt: input.now,
        })
    }

    static reconstitute(props: DistrictProps): District {
        return new District({ ...props })
    }

    get id(): string {
        return this.props.id
    }
    get name(): string {
        return this.props.name
    }
    get center(): Location {
        return this.props.center
    }
    get radiusMeters(): number {
        return this.props.radiusMeters
    }
    get waitMinutes(): number {
        return this.props.waitMinutes
    }
    get createdAt(): Date {
        return this.props.createdAt
    }
    get updatedAt(): Date {
        return this.props.updatedAt
    }

    /** A new center or radius; the shops' districts are recomputed by the caller. */
    moveTo(center: Location, radiusMeters: number, now: Date): void {
        this.props.center = center
        this.props.radiusMeters = requireInteger(
            "radiusMeters",
            radiusMeters,
            MIN_RADIUS_METERS,
            MAX_RADIUS_METERS,
        )
        this.props.updatedAt = now
    }

    setWaitMinutes(minutes: number, now: Date): void {
        this.props.waitMinutes = requireInteger("waitMinutes", minutes, 1, MAX_WAIT_MINUTES)
        this.props.updatedAt = now
    }

    contains(location: Location): boolean {
        return this.props.center.distanceTo(location) <= this.props.radiusMeters
    }

    /** When a network order requested at `requestedAt` counts as waiting too long. */
    overdueAt(requestedAt: Date): Date {
        return new Date(requestedAt.getTime() + this.props.waitMinutes * MS_PER_MINUTE)
    }
}

/** The district a location belongs to: the closest center among those that contain it. */
export function districtOf(
    districts: readonly District[],
    location: Location | undefined,
): District | undefined {
    if (!location) {
        return undefined
    }
    return districts
        .filter((district) => district.contains(location))
        .sort((a, b) => a.center.distanceTo(location) - b.center.distanceTo(location))[0]
}
