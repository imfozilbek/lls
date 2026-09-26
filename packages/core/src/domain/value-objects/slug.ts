import { ValidationError } from "../errors/validation.error.js"

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/
const MAX_LENGTH = 40
const BOT_SUFFIX = /[_-]?bot$/

/** Public shop address used in links: lowercase latin letters, digits and dashes, 3-40 chars. */
export class Slug {
    private constructor(public readonly value: string) {}

    static create(value: string): Slug {
        if (!SLUG_PATTERN.test(value) || value.includes("--")) {
            throw ValidationError.fromField(
                "slug",
                "Use 3-40 latin letters, digits and single dashes",
                value,
            )
        }
        return new Slug(value)
    }

    /** "Osh_Markaz_bot" → "osh-markaz". Falls back to the full username if the rest is too short. */
    static fromBotUsername(username: string): Slug {
        const base = Slug.normalize(username.toLowerCase().replace(BOT_SUFFIX, ""))
        const candidate = base.length >= 3 ? base : Slug.normalize(username.toLowerCase())
        return Slug.create(candidate)
    }

    /** "osh-markaz" + 2 → "osh-markaz-2", trimmed to fit the max length. */
    withSuffix(n: number): Slug {
        const suffix = `-${n}`
        const head = this.value.slice(0, MAX_LENGTH - suffix.length).replace(/-+$/, "")
        return Slug.create(head + suffix)
    }

    private static normalize(value: string): string {
        return value
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, MAX_LENGTH)
            .replace(/-$/, "")
    }
}
