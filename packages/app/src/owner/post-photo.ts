import { fetchWithin } from "../lib/deadline.js"

import { CollageLayout, cellsOf, collageSize, coverCrop } from "./post-collage.js"

/** Telegram shows a channel photo up to 1280 px; more only makes the upload slower. */
const POST_QUALITY = 0.86
/** Lower qualities tried when a collage comes out over what the Worker takes. */
const FALLBACK_QUALITIES = [0.75, 0.62]
/** The Worker's limit for a post's picture (`MAX_IMAGE_BYTES`), with room to spare. */
const MAX_JPEG_BYTES = 1_450_000
/** A file read: the regional line is slow, a photo is never waited on forever. */
const PHOTO_DEADLINE_MS = 120_000
/** White between the photos of a collage. */
const GAP_PX = 8
const WHITE = "#ffffff"

/** A photo of the catalog, read for drawing (its own address answers CORS). */
export async function fetchPhoto(url: string): Promise<Blob> {
    return fetchWithin(url, { mode: "cors" }, PHOTO_DEADLINE_MS, async (response) => {
        if (!response.ok) {
            throw new Error(`Photo answered ${response.status}`)
        }
        return response.blob()
    })
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
}

/** The smallest quality that still fits; the best one that fits is taken first. */
async function fittingJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
    for (const quality of [POST_QUALITY, ...FALLBACK_QUALITIES]) {
        const jpeg = await toJpeg(canvas, quality)
        if (jpeg && jpeg.size <= MAX_JPEG_BYTES) {
            return jpeg
        }
    }
    throw new Error("No JPEG")
}

/**
 * The post's picture, drawn again as a JPEG: one photo as it is, or two to four as a collage
 * (`post-collage.ts`). The catalog keeps WebP, which Telegram may refuse as a photo; a photo with
 * transparency gets a white page under it.
 */
export async function drawPostPicture(
    photos: readonly Blob[],
    layout: CollageLayout,
): Promise<Blob> {
    const bitmaps = await Promise.all(photos.map((photo) => createImageBitmap(photo)))
    try {
        const first = bitmaps[0]
        if (!first) {
            throw new Error("No photo")
        }
        const size = collageSize(layout, first)
        const canvas = document.createElement("canvas")
        canvas.width = size.width
        canvas.height = size.height
        const context = canvas.getContext("2d")
        if (!context) {
            throw new Error("No canvas")
        }
        context.fillStyle = WHITE
        context.fillRect(0, 0, size.width, size.height)
        const gap = layout === CollageLayout.SINGLE ? 0 : GAP_PX / 2
        cellsOf(layout).forEach((cell, index) => {
            const bitmap = bitmaps[index]
            if (!bitmap) {
                return
            }
            const x = cell.x * size.width + (cell.x > 0 ? gap : 0)
            const y = cell.y * size.height + (cell.y > 0 ? gap : 0)
            const w = cell.w * size.width - (cell.x > 0 ? gap : 0) - (cell.x + cell.w < 1 ? gap : 0)
            const h =
                cell.h * size.height - (cell.y > 0 ? gap : 0) - (cell.y + cell.h < 1 ? gap : 0)
            const crop = coverCrop(bitmap, { width: w, height: h })
            context.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, x, y, w, h)
        })
        return await fittingJpeg(canvas)
    } finally {
        for (const bitmap of bitmaps) {
            bitmap.close()
        }
    }
}

/** The product's photo for its channel post, drawn again as a JPEG. */
export async function drawPostPhoto(url: string): Promise<Blob> {
    return drawPostPicture([await fetchPhoto(url)], CollageLayout.SINGLE)
}
