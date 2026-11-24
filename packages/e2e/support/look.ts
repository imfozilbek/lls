/**
 * How a screen looks to a person (goal 24): a card that melts into what is under it (white on
 * white, gray on gray: the same color, no shadow, no border), and a tap target under 44 px.
 * Both run in the page on what is visible now.
 *
 * A target a little smaller (36 px or more each way) passes when a 44 px circle on its middle
 * reaches no other target: WCAG 2.5.8's spacing rule, at a finger's size instead of 24 px. The
 * week's seven days fit a 360 px phone only so (41 px wide, 4 px apart).
 */
import type { Page } from "@playwright/test"

export interface Flat {
    what: string
    color: string
}

export interface SmallTarget {
    what: string
    width: number
    height: number
}

/** Runs in the page: no imports, plain DOM. A rounded surface the same color as under it. */
function scanFlat(): Flat[] {
    const describe = (element: Element): string => {
        const text = (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40)
        return text || `<${element.tagName.toLowerCase()} class="${element.className}">`
    }
    const opaque = (css: string): string | null => {
        const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(css)
        if (!match) {
            return null
        }
        return match[4] === undefined || Number(match[4]) >= 1
            ? `rgb(${match[1]}, ${match[2]}, ${match[3]})`
            : null
    }
    const under = (element: Element): string | null => {
        for (let node = element.parentElement; node; node = node.parentElement) {
            const color = opaque(getComputedStyle(node).backgroundColor)
            if (color) {
                return color
            }
        }
        return opaque(getComputedStyle(document.body).backgroundColor)
    }
    const found: Flat[] = []
    for (const element of document.querySelectorAll("main *, [role=dialog] *")) {
        const style = getComputedStyle(element)
        const color = opaque(style.backgroundColor)
        const box = element.getBoundingClientRect()
        const rounded = parseFloat(style.borderTopLeftRadius) >= 8
        const outlined =
            style.boxShadow !== "none" ||
            (parseFloat(style.borderTopWidth) > 0 && style.borderTopColor !== style.backgroundColor)
        if (
            !color ||
            !rounded ||
            outlined ||
            box.width < 48 ||
            box.height < 32 ||
            style.backgroundImage !== "none" ||
            element.querySelector("canvas") !== null ||
            element.closest("[aria-hidden='true']")
        ) {
            continue
        }
        if (under(element) === color) {
            found.push({ what: describe(element), color })
        }
    }
    return found
}

/** Runs in the page: what a finger presses, smaller than 44 × 44 px with no room around it. */
function scanTargets(): SmallTarget[] {
    const finger = 44
    const selector =
        "button, a[href], [role=button], [role=tab], [role=radio], [role=switch], [role=checkbox], select, summary, input:not([type=hidden]):not([type=file])"
    // An open sheet covers the screen: what is behind it cannot be pressed.
    const modal = document.querySelector("[aria-modal='true']")
    /**
     * Not a target to judge: hidden, disabled, behind an open sheet, or a link inside a sentence
     * (read, then pressed).
     */
    const skipped = (element: Element, box: DOMRect): boolean =>
        (modal !== null && !modal.contains(element)) ||
        box.width === 0 ||
        box.height === 0 ||
        getComputedStyle(element).visibility === "hidden" ||
        element.closest("[aria-hidden='true'], [inert]") !== null ||
        (element as HTMLButtonElement).disabled ||
        (element.tagName === "A" && element.closest("p") !== null)
    const targets: { element: Element; box: DOMRect }[] = []
    for (const element of document.querySelectorAll(selector)) {
        // A field inside its label is pressed anywhere on the label.
        const pressed = element.matches("input, select")
            ? (element.closest("label") ?? element)
            : element
        const box = pressed.getBoundingClientRect()
        if (!skipped(element, box)) {
            targets.push({ element, box })
        }
    }
    /** How far a point is from a box: 0 inside it. */
    const away = (x: number, y: number, box: DOMRect): number =>
        Math.hypot(
            Math.max(box.left - x, 0, x - box.right),
            Math.max(box.top - y, 0, y - box.bottom),
        )
    /** A little smaller, with a finger's circle around its middle that touches no other target. */
    const roomy = (box: DOMRect): boolean => {
        const x = box.left + box.width / 2
        const y = box.top + box.height / 2
        return (
            Math.min(box.width, box.height) >= 36 &&
            targets.every((other) => other.box === box || away(x, y, other.box) >= finger / 2)
        )
    }
    return targets
        .filter(({ box }) => (box.width < finger - 0.5 || box.height < finger - 0.5) && !roomy(box))
        .map(({ element, box }) => ({
            what:
                (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40) ||
                element.getAttribute("aria-label") ||
                element.tagName.toLowerCase(),
            width: Math.round(box.width),
            height: Math.round(box.height),
        }))
}

export function flatSurfaces(page: Page): Promise<Flat[]> {
    return page.evaluate(scanFlat)
}

export function smallTargets(page: Page): Promise<SmallTarget[]> {
    return page.evaluate(scanTargets)
}
