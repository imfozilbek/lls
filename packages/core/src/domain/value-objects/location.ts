import { ValidationError } from "../errors/validation.error.js"

const EARTH_RADIUS_METERS = 6_371_000
const MAX_LATITUDE = 90
const MAX_LONGITUDE = 180

function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180
}

export class Location {
    private constructor(
        public readonly latitude: number,
        public readonly longitude: number,
    ) {}

    static create(latitude: number, longitude: number): Location {
        if (!Number.isFinite(latitude) || Math.abs(latitude) > MAX_LATITUDE) {
            throw ValidationError.fromField("latitude", "Must be between -90 and 90", latitude)
        }
        if (!Number.isFinite(longitude) || Math.abs(longitude) > MAX_LONGITUDE) {
            throw ValidationError.fromField("longitude", "Must be between -180 and 180", longitude)
        }
        return new Location(latitude, longitude)
    }

    /** Great-circle distance in meters (haversine). */
    distanceTo(other: Location): number {
        const dLat = toRadians(other.latitude - this.latitude)
        const dLng = toRadians(other.longitude - this.longitude)
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRadians(this.latitude)) *
                Math.cos(toRadians(other.latitude)) *
                Math.sin(dLng / 2) ** 2
        return Math.round(2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a)))
    }

    equals(other: Location): boolean {
        return this.latitude === other.latitude && this.longitude === other.longitude
    }
}
