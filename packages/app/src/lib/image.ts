const MAX_SIDE = 1024
const QUALITY = 0.82
/**
 * A bank screenshot is tall and full of small digits: it keeps more pixels than a photo, yet
 * 1280 px on its long side still reads the sum and the card (and keeps 30 days of them small).
 */
const RECEIPT_SIDE = 1280
const RECEIPT_QUALITY = 0.86
/** Under the Worker's 1.5 MB limit; a camera photo of a paper receipt may need a second try. */
const RECEIPT_MAX_BYTES = 1_400_000
const RECEIPT_FALLBACK_QUALITY = 0.7

/** Loads a picked photo, scales it to ≤1024 px and re-encodes (WebP, JPEG where WebP is missing). */
export async function compressImage(file: File, maxSide: number = MAX_SIDE): Promise<Blob> {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) {
        bitmap.close()
        return file
    }
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const encode = (type: string): Promise<Blob | null> =>
        new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY))
    // Old iOS WebViews cannot encode WebP and silently return PNG; JPEG is the safe fallback.
    const webp = await encode("image/webp")
    if (webp?.type === "image/webp") {
        return webp
    }
    return (await encode("image/jpeg")) ?? file
}

/**
 * The transfer screenshot for «O'tkazdim»: JPEG (Telegram shows it in the owner's chat as is),
 * large enough for the sum and the card digits to stay readable.
 */
export async function compressReceipt(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, RECEIPT_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext("2d")
    if (!context) {
        bitmap.close()
        return file
    }
    // JPEG has no transparency: a white page under a PNG screenshot instead of black.
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const encode = (quality: number): Promise<Blob | null> =>
        new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
    const jpeg = await encode(RECEIPT_QUALITY)
    if (jpeg && jpeg.size > RECEIPT_MAX_BYTES) {
        return (await encode(RECEIPT_FALLBACK_QUALITY)) ?? jpeg
    }
    return jpeg ?? file
}
