export interface Coordinates {
    latitude: number
    longitude: number
}

export class Address {
    private constructor(
        public readonly street: string,
        public readonly city: string,
        public readonly coordinates?: Coordinates,
    ) {
        if (!street.trim()) {
            throw new Error("Street is required")
        }
        if (!city.trim()) {
            throw new Error("City is required")
        }
    }

    static create(street: string, city: string, coordinates?: Coordinates): Address {
        return new Address(street.trim(), city.trim(), coordinates)
    }

    format(): string {
        return `${this.street}, ${this.city}`
    }

    hasCoordinates(): boolean {
        return this.coordinates !== undefined
    }

    equals(other: Address): boolean {
        return this.street === other.street && this.city === other.city
    }
}
