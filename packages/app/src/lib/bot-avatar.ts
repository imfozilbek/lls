import { ZUMDA_BRAND_CHANNELS, ZUMDA_MARK, readableInk } from "./brand.js"
import { hexToRgbChannels } from "./format.js"
import { drawZumdaMark } from "./zumda-canvas.js"

/** Telegram shows a bot's picture as a circle; 640 px is its full size. */
export const AVATAR_SIZE = 640
const CENTER = AVATAR_SIZE / 2
/** The Zumda badge sits inside the visible circle, at the bottom right. */
const BADGE = 168
const BADGE_RING = 14
const BADGE_CENTER = 470
/** Text stays inside the circle and clear of the badge. */
const TEXT_WIDTH = 440
const TEXT_MAX = 150
const TEXT_MIN = 64
const LINE_HEIGHT = 1.08
const JPEG_QUALITY = 0.9
const FONT = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

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

/** The largest size at which every line fits, or null when even the smallest is too wide. */
function fittingSize(ctx: CanvasRenderingContext2D, lines: string[]): number | null {
    for (let size = TEXT_MAX; size >= TEXT_MIN; size -= 4) {
        ctx.font = `800 ${size}px ${FONT}`
        if (lines.every((line) => ctx.measureText(line).width <= TEXT_WIDTH)) {
            return size
        }
    }
    return null
}

function drawName(ctx: CanvasRenderingContext2D, name: string, channels: string): void {
    ctx.fillStyle = `rgb(${channels.split(" ").join(", ")})`
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE)
    ctx.fillStyle = `rgb(${readableInk(channels).split(" ").join(", ")})`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    let best: { lines: string[]; size: number } | null = null
    for (const lines of avatarLines(name)) {
        const size = fittingSize(ctx, lines)
        if (size !== null && (!best || size > best.size)) {
            best = { lines, size }
        }
    }
    const chosen = best ?? { lines: [initials(name)], size: TEXT_MAX * 1.6 }
    ctx.font = `800 ${chosen.size}px ${FONT}`
    const step = chosen.size * LINE_HEIGHT
    const top = CENTER - (step * (chosen.lines.length - 1)) / 2
    chosen.lines.forEach((line, index) => ctx.fillText(line, CENTER, top + index * step))
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
