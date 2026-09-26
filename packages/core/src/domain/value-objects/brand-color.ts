import { ValidationError } from "../errors/validation.error.js"

const HEX_COLOR = /^#[0-9a-f]{6}$/
const DEFAULT_BRAND_COLOR = "#0ea5e9"

export class BrandColor {
    private constructor(public readonly hex: string) {}

    static create(value: string): BrandColor {
        const normalized = value.trim().toLowerCase()
        if (!HEX_COLOR.test(normalized)) {
            throw ValidationError.fromField("brandColor", "Must be a hex color like #0ea5e9", value)
        }
        return new BrandColor(normalized)
    }

    static default(): BrandColor {
        return new BrandColor(DEFAULT_BRAND_COLOR)
    }
}
