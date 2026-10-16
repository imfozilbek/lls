const UUID_BYTES = 16
const VERSION_BYTE = 6
const VARIANT_BYTE = 8

/**
 * A random v4 UUID. `crypto.randomUUID` exists only from Chrome 92 and iOS 15.4: an older
 * phone's web view (regional phones keep them for years) would show a white screen without it.
 * `getRandomValues` is there much longer.
 */
export function uuid(): string {
    if (typeof crypto.randomUUID === "function") {
        return crypto.randomUUID()
    }
    const bytes = crypto.getRandomValues(new Uint8Array(UUID_BYTES))
    bytes[VERSION_BYTE] = ((bytes[VERSION_BYTE] ?? 0) & 0x0f) | 0x40
    bytes[VARIANT_BYTE] = ((bytes[VARIANT_BYTE] ?? 0) & 0x3f) | 0x80
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20),
    ].join("-")
}
