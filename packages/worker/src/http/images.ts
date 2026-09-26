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
        throw new ApiError(413, "IMAGE_TOO_LARGE", "Image must be at most 1.5 MB")
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
