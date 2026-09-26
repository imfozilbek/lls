const MAX_SIDE = 1024
const QUALITY = 0.82

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
