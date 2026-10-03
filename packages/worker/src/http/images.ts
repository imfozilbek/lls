import { randomToken } from "../crypto.js"

import { ApiError } from "./errors.js"

const EXTENSIONS: Record<string, string> = {
    "image/webp": "webp",
    "image/jpeg": "jpg",
    "image/png": "png",
}

/** The app resizes to ≤1024px WebP before upload, so real files are ~100 KB. */
export const MAX_IMAGE_BYTES = 1_500_000
export const IMMUTABLE_CACHE = "public, max-age=31536000, immutable"
export const IMAGE_KEY_PREFIX = "shops/"

const tooLarge = (): ApiError =>
    new ApiError(413, "IMAGE_TOO_LARGE", "Image must be at most 1.5 MB")

/**
 * Reads an upload but never more than MAX_IMAGE_BYTES: a declared or streamed body that is too
 * large is refused before it fills the Worker's memory.
 */
export async function readImageBody(request: Request): Promise<ArrayBuffer> {
    const declared = Number(request.headers.get("Content-Length") ?? 0)
    if (declared > MAX_IMAGE_BYTES) {
        throw tooLarge()
    }
    if (!request.body) {
        return new ArrayBuffer(0)
    }
    const reader = request.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
        const { done, value } = await reader.read()
        if (done) {
            break
        }
        size += value.byteLength
        if (size > MAX_IMAGE_BYTES) {
            await reader.cancel()
            throw tooLarge()
        }
        chunks.push(value)
    }
    const body = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
        body.set(chunk, offset)
        offset += chunk.byteLength
    }
    return body.buffer
}

const RIFF_HEADER_BYTES = 12

/** The first bytes must match the declared type: a renamed HTML file is not an image. */
export function looksLike(type: string, body: ArrayBuffer): boolean {
    const b = new Uint8Array(body.slice(0, RIFF_HEADER_BYTES))
    const text = (from: number, to: number): string => String.fromCharCode(...b.slice(from, to))
    switch (type) {
        case "image/jpeg":
            return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
        case "image/png":
            return b[0] === 0x89 && text(1, 4) === "PNG"
        case "image/webp":
            return text(0, 4) === "RIFF" && text(8, 12) === "WEBP"
        default:
            return false
    }
}

/** A JPEG made by the app (a bot picture): anything else is refused before Telegram sees it. */
export async function readJpeg(request: Request): Promise<Uint8Array> {
    const type = request.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase()
    const body = await readImageBody(request)
    if (type !== "image/jpeg" || body.byteLength === 0 || !looksLike(type, body)) {
        throw new ApiError(415, "UNSUPPORTED_IMAGE", "Upload a JPEG image")
    }
    return new Uint8Array(body)
}

/** Stores an uploaded image under `prefix` and returns its R2 key. */
export async function storeImage(
    bucket: R2Bucket,
    prefix: string,
    contentType: string | undefined,
    body: ArrayBuffer,
): Promise<string> {
    const type = contentType?.split(";")[0]?.trim().toLowerCase() ?? ""
    const extension = EXTENSIONS[type]
    if (!extension) {
        throw new ApiError(415, "UNSUPPORTED_IMAGE", "Upload a WebP, JPEG or PNG image")
    }
    if (body.byteLength === 0 || body.byteLength > MAX_IMAGE_BYTES) {
        throw tooLarge()
    }
    if (!looksLike(type, body)) {
        throw new ApiError(415, "UNSUPPORTED_IMAGE", "Upload a WebP, JPEG or PNG image")
    }
    const key = `${prefix}/${randomToken(9)}.${extension}`
    await bucket.put(key, body, {
        httpMetadata: { contentType: type, cacheControl: IMMUTABLE_CACHE },
    })
    return key
}

export async function deleteImage(bucket: R2Bucket, key: string | undefined): Promise<void> {
    if (key?.startsWith(IMAGE_KEY_PREFIX)) {
        await bucket.delete(key)
    }
}
