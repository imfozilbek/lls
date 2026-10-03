import { ZUMDA_MARK } from "./brand.js"

/**
 * Draws the Zumda mark on a canvas: a `size` square at (x, y), clipped to a circle or a rounded
 * tile. The poster footer and the shop bot's picture use it; React uses `ui/zumda-mark.tsx`.
 */
export function drawZumdaMark(
    ctx: CanvasRenderingContext2D,
    at: { x: number; y: number; size: number },
    shape: "circle" | "tile",
): void {
    const { box, door } = ZUMDA_MARK
    ctx.save()
    ctx.beginPath()
    if (shape === "circle") {
        ctx.arc(at.x + at.size / 2, at.y + at.size / 2, at.size / 2, 0, Math.PI * 2)
    } else {
        ctx.roundRect(at.x, at.y, at.size, at.size, at.size * 0.24)
    }
    ctx.clip()
    ctx.translate(at.x, at.y)
    ctx.scale(at.size / box, at.size / box)
    ctx.fillStyle = ZUMDA_MARK.mint
    ctx.fillRect(0, 0, box, box)
    ctx.fillStyle = ZUMDA_MARK.green
    ctx.fill(new Path2D(ZUMDA_MARK.pin))
    ctx.strokeStyle = ZUMDA_MARK.white
    ctx.lineWidth = ZUMDA_MARK.roofWidth
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.stroke(new Path2D(ZUMDA_MARK.roof))
    ctx.fillStyle = ZUMDA_MARK.white
    ctx.beginPath()
    ctx.roundRect(door.x, door.y, door.width, door.height, door.radius)
    ctx.fill()
    ctx.restore()
}
