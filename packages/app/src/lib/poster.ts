import { encode } from "uqr"

import { ZUMDA_BRAND_CHANNELS, readableInk } from "./brand.js"
import { hexToRgbChannels } from "./format.js"
import { drawZumdaMark } from "./zumda-canvas.js"

/** 4:5: fits an A4 print and an Instagram post. */
const WIDTH = 1080
const HEIGHT = 1350
const PAD = 64
const HEADER = 460
const LOGO = 150
const QR_BOX = 600
const QR_QUIET = 36
const FONT = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
const PAPER = "#ffffff"
const INK = "#111827"
const MUTED = "#6b7280"
const LOGO_TIMEOUT_MS = 4000
const MARK = 40
const MARK_GAP = 12

export interface PosterInput {
    shopName: string
    /** What the QR opens: the shop's bot, or Zumda Shop on the shop. */
    link: string
    /** The link as people read it under the QR, e.g. `t.me/zumdashop_bot`. */
    linkLabel: string
    brandColor: string
    /** Full URL of the shop's logo, if it has one. */
    logoUrl: string | null
    /** "Telegram orqali buyurtma bering": the product speaks Uzbek only. */
    line: string
    /** "Zumda asosida ishlaydi": the footer, next to the Zumda mark. */
    poweredBy: string
}

/** The link the poster's QR opens: the shop's bot, where the menu button starts the shop. */
export function shopBotLink(botUsername: string): string {
    return `https://t.me/${botUsername}`
}

/** Zumda | Shop, the customers' bot (the deploy sets it; the stand has its own). */
export const ZUMDA_SHOP_BOT: string = import.meta.env.VITE_SHOP_BOT ?? "zumdashop_bot"

/**
 * Zumda Shop opening right on this shop (owner's decision, goal 16): its main Mini App gets
 * `m_<slug>` and shows the shop inside the showcase; Back leads to the other shops.
 */
export function zumdaShopLink(slug: string): string {
    return `https://t.me/${ZUMDA_SHOP_BOT}?startapp=m_${slug}`
}

function rgb(channels: string): string {
    return `rgb(${channels.split(" ").join(", ")})`
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const image = new Image()
        // The Worker serves photos with CORS: the canvas stays exportable.
        image.crossOrigin = "anonymous"
        const timer = window.setTimeout(() => resolve(null), LOGO_TIMEOUT_MS)
        image.onload = (): void => {
            window.clearTimeout(timer)
            resolve(image)
        }
        image.onerror = (): void => {
            window.clearTimeout(timer)
            resolve(null)
        }
        image.src = url
    })
}

/** Largest font size (down to `min`) at which the text fits the width. */
function fitFont(
    ctx: CanvasRenderingContext2D,
    text: string,
    weight: number,
    max: number,
    min: number,
): void {
    let size = max
    ctx.font = `${weight} ${size}px ${FONT}`
    while (size > min && ctx.measureText(text).width > WIDTH - PAD * 2) {
        size -= 2
        ctx.font = `${weight} ${size}px ${FONT}`
    }
}

function roundRect(
    ctx: CanvasRenderingContext2D,
    box: { x: number; y: number; w: number; h: number },
    radius: number,
): void {
    ctx.beginPath()
    ctx.roundRect(box.x, box.y, box.w, box.h, radius)
    ctx.fill()
}

function drawHeader(
    ctx: CanvasRenderingContext2D,
    input: PosterInput,
    logo: HTMLImageElement | null,
): void {
    const channels = hexToRgbChannels(input.brandColor) ?? ZUMDA_BRAND_CHANNELS
    const ink = rgb(readableInk(channels))
    ctx.fillStyle = rgb(channels)
    ctx.fillRect(0, 0, WIDTH, HEADER)

    const x = (WIDTH - LOGO) / 2
    const y = PAD
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(x, y, LOGO, LOGO, LOGO * 0.3)
    ctx.clip()
    if (logo) {
        ctx.drawImage(logo, x, y, LOGO, LOGO)
    } else {
        ctx.fillStyle = PAPER
        ctx.fillRect(x, y, LOGO, LOGO)
        ctx.fillStyle = rgb(channels)
        ctx.font = `700 84px ${FONT}`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(input.shopName.trim().charAt(0).toUpperCase(), WIDTH / 2, y + LOGO / 2 + 4)
    }
    ctx.restore()

    ctx.fillStyle = ink
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    fitFont(ctx, input.shopName, 800, 76, 40)
    ctx.fillText(input.shopName, WIDTH / 2, y + LOGO + 92)
}

function drawQr(ctx: CanvasRenderingContext2D, link: string, top: number): void {
    const x = (WIDTH - QR_BOX) / 2
    ctx.fillStyle = PAPER
    ctx.shadowColor = "rgba(17, 24, 39, 0.16)"
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 12
    roundRect(ctx, { x, y: top, w: QR_BOX, h: QR_BOX }, 48)
    ctx.shadowColor = "transparent"

    const qr = encode(link, { ecc: "M", border: 0 })
    const inner = QR_BOX - QR_QUIET * 2
    // Whole pixels per module: crisp edges, easy for any camera.
    const module = Math.floor(inner / qr.size)
    const offset = x + (QR_BOX - module * qr.size) / 2
    const offsetY = top + (QR_BOX - module * qr.size) / 2
    ctx.fillStyle = INK
    qr.data.forEach((row, r) => {
        row.forEach((dark, c) => {
            if (dark) {
                ctx.fillRect(offset + c * module, offsetY + r * module, module, module)
            }
        })
    })
}

function drawFooter(ctx: CanvasRenderingContext2D, input: PosterInput, top: number): void {
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = INK
    fitFont(ctx, input.line, 800, 54, 32)
    ctx.fillText(input.line, WIDTH / 2, top + 30)
    ctx.font = `600 34px ${FONT}`
    ctx.fillText(input.linkLabel, WIDTH / 2, top + 110)
    drawPoweredBy(ctx, input.poweredBy)
}

/** The Zumda mark and "Zumda asosida ishlaydi", centered together at the bottom. */
function drawPoweredBy(ctx: CanvasRenderingContext2D, text: string): void {
    ctx.font = `600 26px ${FONT}`
    const width = MARK + MARK_GAP + ctx.measureText(text).width
    const left = (WIDTH - width) / 2
    const baseline = HEIGHT - 44
    drawZumdaMark(ctx, { x: left, y: baseline - MARK + 6, size: MARK }, "tile")
    ctx.fillStyle = MUTED
    ctx.textAlign = "left"
    ctx.fillText(text, left + MARK + MARK_GAP, baseline)
}

function render(input: PosterInput, logo: HTMLImageElement | null): HTMLCanvasElement {
    const canvas = document.createElement("canvas")
    canvas.width = WIDTH
    canvas.height = HEIGHT
    const ctx = canvas.getContext("2d")
    if (!ctx) {
        throw new Error("Canvas is not available")
    }
    ctx.fillStyle = PAPER
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    drawHeader(ctx, input, logo)
    const qrTop = HEADER - 80
    drawQr(ctx, input.link, qrTop)
    drawFooter(ctx, input, qrTop + QR_BOX + 100)
    return canvas
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        try {
            canvas.toBlob(
                (blob) => (blob ? resolve(blob) : reject(new Error("Empty poster"))),
                "image/png",
            )
        } catch (error) {
            // A logo without CORS taints the canvas: the caller draws it again without one.
            reject(error instanceof Error ? error : new Error(String(error)))
        }
    })
}

/** The shop's poster as a PNG: name, logo, a QR (its bot or Zumda Shop), a call to order. */
export async function drawPoster(input: PosterInput): Promise<Blob> {
    await document.fonts.ready.catch(() => undefined)
    const logo = input.logoUrl ? await loadImage(input.logoUrl) : null
    try {
        return await toPng(render(input, logo))
    } catch (error) {
        if (!logo) {
            throw error
        }
        return toPng(render(input, null))
    }
}
