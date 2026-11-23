/**
 * The photos of a channel post drawn as one picture (owner's decision, November 2026): Telegram
 * shows no button under an album, so two to four photos become a collage with «Buyurtma berish»
 * under it. Pure: the cells of each layout, as parts of the picture.
 */

export const MAX_POST_PHOTOS = 4

export enum CollageLayout {
    /** One photo as it is. */
    SINGLE = "single",
    SIDE = "side",
    STACK = "stack",
    /** One large on the left, two small on the right. */
    BIG_TWO = "bigTwo",
    GRID = "grid",
}

/** A cell of the picture, each side a part of it (0..1). */
export interface CollageCell {
    x: number
    y: number
    w: number
    h: number
}

/** The picture's sides in pixels (Telegram shows a channel photo up to 1280). */
export interface CollageSize {
    width: number
    height: number
}

const SIDE_PX = 1280
const SHORT_PX = 800
const HALF = 0.5
const TWO_THIRDS = 2 / 3

const CELLS: Record<CollageLayout, CollageCell[]> = {
    [CollageLayout.SINGLE]: [{ x: 0, y: 0, w: 1, h: 1 }],
    [CollageLayout.SIDE]: [
        { x: 0, y: 0, w: HALF, h: 1 },
        { x: HALF, y: 0, w: HALF, h: 1 },
    ],
    [CollageLayout.STACK]: [
        { x: 0, y: 0, w: 1, h: HALF },
        { x: 0, y: HALF, w: 1, h: HALF },
    ],
    [CollageLayout.BIG_TWO]: [
        { x: 0, y: 0, w: TWO_THIRDS, h: 1 },
        { x: TWO_THIRDS, y: 0, w: 1 - TWO_THIRDS, h: HALF },
        { x: TWO_THIRDS, y: HALF, w: 1 - TWO_THIRDS, h: HALF },
    ],
    [CollageLayout.GRID]: [
        { x: 0, y: 0, w: HALF, h: HALF },
        { x: HALF, y: 0, w: HALF, h: HALF },
        { x: 0, y: HALF, w: HALF, h: HALF },
        { x: HALF, y: HALF, w: HALF, h: HALF },
    ],
}

const SIZES: Record<Exclude<CollageLayout, CollageLayout.SINGLE>, CollageSize> = {
    [CollageLayout.SIDE]: { width: SIDE_PX, height: SHORT_PX },
    [CollageLayout.STACK]: { width: SHORT_PX, height: SIDE_PX },
    [CollageLayout.BIG_TWO]: { width: SIDE_PX, height: SHORT_PX },
    [CollageLayout.GRID]: { width: SIDE_PX, height: SIDE_PX },
}

/** The layouts that fit this many photos, the usual one first. */
export function layoutsFor(count: number): CollageLayout[] {
    switch (count) {
        case 1:
            return [CollageLayout.SINGLE]
        case 2:
            return [CollageLayout.SIDE, CollageLayout.STACK]
        case 3:
            return [CollageLayout.BIG_TWO]
        case MAX_POST_PHOTOS:
            return [CollageLayout.GRID]
        default:
            return []
    }
}

/** The layout the owner picked, while it still fits; else the usual one. */
export function layoutOr(picked: CollageLayout | null, count: number): CollageLayout | null {
    const fitting = layoutsFor(count)
    return picked && fitting.includes(picked) ? picked : (fitting[0] ?? null)
}

export function cellsOf(layout: CollageLayout): CollageCell[] {
    return CELLS[layout]
}

/** A collage's size; one photo keeps its own sides (at most 1280 on the longer). */
export function collageSize(layout: CollageLayout, single: CollageSize): CollageSize {
    if (layout !== CollageLayout.SINGLE) {
        return SIZES[layout]
    }
    const scale = Math.min(1, SIDE_PX / Math.max(single.width, single.height))
    return {
        width: Math.round(single.width * scale),
        height: Math.round(single.height * scale),
    }
}

/** The part of a photo that fills a cell without stretching: its middle, cut to the cell. */
export function coverCrop(
    photo: CollageSize,
    cell: CollageSize,
): { sx: number; sy: number; sw: number; sh: number } {
    const scale = Math.max(cell.width / photo.width, cell.height / photo.height)
    const sw = cell.width / scale
    const sh = cell.height / scale
    return { sx: (photo.width - sw) / 2, sy: (photo.height - sh) / 2, sw, sh }
}
