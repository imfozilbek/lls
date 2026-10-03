/**
 * Reads every visible piece of text on the page the way a person in the sun would: its color
 * against the surface right under it (WCAG contrast), and its size. Returns what fails.
 */
import type { Page } from "@playwright/test"

export interface Unreadable {
    text: string
    ratio: number
    size: number
}

/** Runs in the page: no imports, plain DOM. */
function scan(): Unreadable[] {
    type Rgba = [number, number, number, number]
    const canvas = document.createElement("canvas").getContext("2d")
    // The browser turns any CSS color (rgb, color-mix, color(srgb …)) into rgba pixels.
    const parse = (css: string): Rgba => {
        if (!canvas) {
            return [0, 0, 0, 1]
        }
        canvas.clearRect(0, 0, 1, 1)
        canvas.fillStyle = css
        canvas.fillRect(0, 0, 1, 1)
        const [r = 0, g = 0, b = 0, a = 0] = canvas.getImageData(0, 0, 1, 1).data
        return [r, g, b, a / 255]
    }
    const over = (top: Rgba, under: Rgba): Rgba =>
        top.map((c, i) => (i === 3 ? 1 : c * top[3] + (under[i] ?? 0) * (1 - top[3]))) as Rgba
    const background = (element: Element): Rgba => {
        const layers: Rgba[] = []
        for (let node: Element | null = element; node; node = node.parentElement) {
            const style = getComputedStyle(node)
            if (style.backgroundImage !== "none") {
                return [255, 255, 255, 1] // a picture under the text: not judged here
            }
            const color = parse(style.backgroundColor)
            if (color[3] > 0) {
                layers.push(color)
                if (color[3] >= 1) {
                    break
                }
            }
        }
        return layers.reduceRight<Rgba>((under, top) => over(top, under), [255, 255, 255, 1])
    }
    const luminance = ([r, g, b]: Rgba): number => {
        const channel = (c: number): number => {
            const v = c / 255
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
        }
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    }
    const isFaded = (element: Element): boolean => {
        // Text that is fading in, or under a modal backdrop, is not what the person reads.
        for (let up: Element | null = element; up; up = up.parentElement) {
            if (Number(getComputedStyle(up).opacity) < 1) {
                return true
            }
        }
        return element.closest("[inert]") !== null
    }
    /** The element of a text node a person actually reads, or null. */
    const readable = (node: Node): Element | null => {
        const element = node.parentElement
        if (!node.textContent?.trim() || !element) {
            return null
        }
        if (element.closest("[aria-hidden='true'], [disabled], svg")) {
            return null
        }
        const box = element.getBoundingClientRect()
        if (box.width === 0 || box.height === 0) {
            return null
        }
        return getComputedStyle(element).visibility === "hidden" || isFaded(element)
            ? null
            : element
    }
    const judge = (node: Node): Unreadable | null => {
        const element = readable(node)
        if (!element) {
            return null
        }
        const style = getComputedStyle(element)
        const under = background(element)
        const color = over(parse(style.color), under)
        const [light = 0, dark = 0] = [luminance(color), luminance(under)].sort((a, b) => b - a)
        const ratio = (light + 0.05) / (dark + 0.05)
        const size = Number.parseFloat(style.fontSize)
        const large = size >= 24 || (Number(style.fontWeight) >= 700 && size >= 18.66)
        if (ratio >= (large ? 3 : 4.5) && size >= 13) {
            return null
        }
        return {
            text: (node.textContent ?? "").trim().slice(0, 40),
            ratio: Math.round(ratio * 100) / 100,
            size,
        }
    }
    const failures: Unreadable[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const failure = judge(node)
        if (failure) {
            failures.push(failure)
        }
    }
    return failures
}

export function unreadableText(page: Page): Promise<Unreadable[]> {
    return page.evaluate(scan)
}
