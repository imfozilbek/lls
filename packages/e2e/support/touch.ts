/** A finger on the screen: touch events as a phone sends them, for the page's own gestures. */
import type { Page } from "@playwright/test"

export interface Point {
    x: number
    y: number
}

/** Puts a finger at `from`, moves it to `to` in small steps, and lifts it. */
export async function drag(page: Page, from: Point, to: Point, steps = 10): Promise<void> {
    await page.evaluate(
        ({ start, end, count }) => {
            const target = document.elementFromPoint(start.x, start.y) ?? document.body
            const at = (x: number, y: number): Touch =>
                new Touch({ identifier: 1, target, clientX: x, clientY: y })
            const fire = (type: string, x: number, y: number): void => {
                const touch = at(x, y)
                target.dispatchEvent(
                    new TouchEvent(type, {
                        touches: type === "touchend" ? [] : [touch],
                        changedTouches: [touch],
                        bubbles: true,
                        cancelable: true,
                    }),
                )
            }
            fire("touchstart", start.x, start.y)
            for (let i = 1; i <= count; i++) {
                fire(
                    "touchmove",
                    start.x + ((end.x - start.x) * i) / count,
                    start.y + ((end.y - start.y) * i) / count,
                )
            }
            fire("touchend", end.x, end.y)
        },
        { start: from, end: to, count: steps },
    )
}

/** Right across the middle of the screen: "back". */
export function swipeRight(page: Page): Promise<void> {
    return drag(page, { x: 60, y: 420 }, { x: 260, y: 430 })
}

/** Left across the middle of the screen: "forward". */
export function swipeLeft(page: Page): Promise<void> {
    return drag(page, { x: 300, y: 420 }, { x: 100, y: 430 })
}

/** Down from near the top: pull to refresh. */
export function pullDown(page: Page): Promise<void> {
    return drag(page, { x: 200, y: 140 }, { x: 205, y: 340 })
}
