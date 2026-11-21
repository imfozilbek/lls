import { fetchWithin } from "../lib/deadline.js"

/** Telegram shows a channel photo up to 1280 px; more only makes the upload slower. */
const POST_SIDE = 1280
const POST_QUALITY = 0.86
/** A file read: the regional line is slow, a photo is never waited on forever. */
const PHOTO_DEADLINE_MS = 120_000

/**
 * The product's photo for its channel post, drawn again as a JPEG: the catalog keeps WebP, which
 * Telegram may refuse as a photo. A photo with transparency gets a white page under it.
 */
export async function drawPostPhoto(url: string): Promise<Blob> {
    const file = await fetchWithin(url, { mode: "cors" }, PHOTO_DEADLINE_MS, async (response) => {
        if (!response.ok) {
            throw new Error(`Photo answered ${response.status}`)
        }
        return response.blob()
    })
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, POST_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext("2d")
    if (!context) {
        bitmap.close()
        throw new Error("No canvas")
    }
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const jpeg = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", POST_QUALITY),
    )
    if (!jpeg) {
        throw new Error("No JPEG")
    }
    return jpeg
}
