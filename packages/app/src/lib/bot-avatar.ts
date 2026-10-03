import { ZUMDA_BRAND_CHANNELS, ZUMDA_MARK, readableInk } from "./brand.js"
import { hexToRgbChannels } from "./format.js"
import { drawZumdaMark } from "./zumda-canvas.js"

/** Telegram shows a bot's picture as a circle; 640 px is its full size. */
export const AVATAR_SIZE = 640
const CENTER = AVATAR_SIZE / 2
/** The Zumda badge sits inside the visible circle, at the bottom right. */
const BADGE = 150
const BADGE_RING = 12
const BADGE_CENTER = 462
/** The name keeps this far from the badge and from the circle's edge. */
const BADGE_CLEARANCE = 16
const INNER_RADIUS = 280
/** A little above the middle: the badge takes the bottom right. */
const TEXT_CENTER_Y = 296
const TEXT_MAX = 150
const TEXT_MIN = 56
const INITIALS_MAX = 220
const SIZE_STEP = 4
const LINE_HEIGHT = 1.08
const JPEG_QUALITY = 0.9
const FONT = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

/** One line of the name on the picture, in canvas pixels. */
export interface TextBox {
    left: number
    top: number
    right: number
    bottom: number
}

function distance(x: number, y: number, cx: number, cy: number): number {
    return Math.hypot(x - cx, y - cy)
}

/** Every corner inside the visible circle, and no part under the Zumda badge. */
export function boxesFit(boxes: TextBox[]): boolean {
    const keepOut = BADGE / 2 + BADGE_RING + BADGE_CLEARANCE
    return boxes.every((box) => {
        const corners: [number, number][] = [
            [box.left, box.top],
            [box.right, box.top],
            [box.left, box.bottom],
            [box.right, box.bottom],
        ]
        const inside = corners.every(([x, y]) => distance(x, y, CENTER, CENTER) <= INNER_RADIUS)
        const nearestX = Math.min(Math.max(BADGE_CENTER, box.left), box.right)
        const nearestY = Math.min(Math.max(BADGE_CENTER, box.top), box.bottom)
        return inside && distance(nearestX, nearestY, BADGE_CENTER, BADGE_CENTER) > keepOut
    })
}

export interface BotAvatarInput {
    shopName: string
    brandColor: string
    /** The shop's logo; without one the shop's name is the picture. */
    logo: Blob | null
}

/** "Osh Markaz Saroy" → ["Osh", "Markaz Saroy"]: the name on at most two balanced lines. */
export function avatarLines(name: string): string[][] {
    const words = name.trim().split(/\s+/).filter(Boolean)
    const options: string[][] = [[words.join(" ")]]
    for (let cut = 1; cut < words.length; cut++) {
        options.push([words.slice(0, cut).join(" "), words.slice(cut).join(" ")])
    }
    return options
}

/** "Osh Markaz" → "OM", "Suv" → "S": the fallback when the name is too long to read. */
export function initials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => Array.from(word)[0]?.toUpperCase() ?? "")
        .join("")
}

/** Where each line lands at `size`, centered around TEXT_CENTER_Y. */
function layout(ctx: CanvasRenderingContext2D, lines: string[], size: number): TextBox[] {
    ctx.font = `800 ${size}px ${FONT}`
    const step = size * LINE_HEIGHT
    const first = TEXT_CENTER_Y - (step * (lines.length - 1)) / 2
    return lines.map((line, index) => {
        const metrics = ctx.measureText(line)
        const y = first + index * step
        return {
            left: CENTER - metrics.width / 2,
            right: CENTER + metrics.width / 2,
            top: y - metrics.actualBoundingBoxAscent,
            bottom: y + metrics.actualBoundingBoxDescent,
        }
    })
}

/** The largest size (from `max`) at which the lines fit, or null when even the smallest does not. */
function fittingSize(ctx: CanvasRenderingContext2D, lines: string[], max: number): number | null {
    for (let size = max; size >= TEXT_MIN; size -= SIZE_STEP) {
        if (boxesFit(layout(ctx, lines, size))) {
            return size
        }
    }
    return null
}

/** The name on one or two lines as large as it fits; a name too long to read becomes initials. */
function chooseText(
    ctx: CanvasRenderingContext2D,
    name: string,
): { lines: string[]; size: number } {
    let best: { lines: string[]; size: number } | null = null
    for (const lines of avatarLines(name)) {
        const size = fittingSize(ctx, lines, TEXT_MAX)
        if (size !== null && (!best || size > best.size)) {
            best = { lines, size }
        }
    }
    if (best) {
        return best
    }
    const short = [initials(name)]
    return { lines: short, size: fittingSize(ctx, short, INITIALS_MAX) ?? TEXT_MIN }
}

function drawName(ctx: CanvasRenderingContext2D, name: string, channels: string): void {
    ctx.fillStyle = `rgb(${channels.split(" ").join(", ")})`
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const { lines, size } = chooseText(ctx, name)
    ctx.font = `800 ${size}px ${FONT}`
    ctx.fillStyle = `rgb(${readableInk(channels).split(" ").join(", ")})`
    const step = size * LINE_HEIGHT
    const first = TEXT_CENTER_Y - (step * (lines.length - 1)) / 2
    lines.forEach((line, index) => ctx.fillText(line, CENTER, first + index * step))
}

async function drawLogo(ctx: CanvasRenderingContext2D, logo: Blob): Promise<void> {
    const bitmap = await createImageBitmap(logo)
    const side = Math.min(bitmap.width, bitmap.height)
    const sx = (bitmap.width - side) / 2
    const sy = (bitmap.height - side) / 2
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
    bitmap.close()
}

function drawBadge(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = ZUMDA_MARK.white
    ctx.beginPath()
    ctx.arc(BADGE_CENTER, BADGE_CENTER, BADGE / 2 + BADGE_RING, 0, Math.PI * 2)
    ctx.fill()
    const corner = BADGE_CENTER - BADGE / 2
    drawZumdaMark(ctx, { x: corner, y: corner, size: BADGE }, "circle")
}

/**
 * The shop bot's picture: the shop's logo (or its name on its color) with the Zumda mark at the
 * bottom right, as a JPEG for Telegram's `setMyProfilePhoto`.
 */
export async function drawBotAvatar(input: BotAvatarInput): Promise<Blob> {
    const canvas = document.createElement("canvas")
    canvas.width = AVATAR_SIZE
    canvas.height = AVATAR_SIZE
    const ctx = canvas.getContext("2d")
    if (!ctx) {
        throw new Error("Canvas is not available")
    }
    if (input.logo) {
        // A transparent logo would turn black in a JPEG.
        ctx.fillStyle = ZUMDA_MARK.white
        ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE)
        await drawLogo(ctx, input.logo)
    } else {
        const channels = hexToRgbChannels(input.brandColor) ?? ZUMDA_BRAND_CHANNELS
        drawName(ctx, input.shopName, channels)
    }
    drawBadge(ctx)
    return new Promise((resolve, reject) =>
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("Empty bot picture"))),
            "image/jpeg",
            JPEG_QUALITY,
        ),
    )
}
