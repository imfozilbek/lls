import { hideKeyboard } from "./telegram.js"

/** Fields the keyboard types into; checkboxes, buttons and file pickers are not. */
const TYPING = new Set(["text", "tel", "number", "email", "search", "url", "password", "time"])
/** The keyboard takes about this long to slide up; measuring earlier sees the old viewport. */
const KEYBOARD_SETTLE_MS = 320
/** Room kept between the field and the keyboard's top edge. */
const KEYBOARD_GAP_PX = 24

function isTypingField(element: Element | null): element is HTMLInputElement | HTMLTextAreaElement {
    if (element instanceof HTMLTextAreaElement) {
        return !element.disabled && !element.readOnly
    }
    return (
        element instanceof HTMLInputElement &&
        TYPING.has(element.type) &&
        !element.disabled &&
        !element.readOnly
    )
}

/** The fields on screen in reading order, inside the open sheet when there is one. */
function fieldsOnScreen(): (HTMLInputElement | HTMLTextAreaElement)[] {
    const dialogs = document.querySelectorAll('[role="dialog"]')
    const scope = dialogs.length > 0 ? dialogs[dialogs.length - 1] : document
    return [...(scope?.querySelectorAll("input, textarea") ?? [])].filter(
        (element): element is HTMLInputElement | HTMLTextAreaElement =>
            isTypingField(element) && element.getClientRects().length > 0,
    )
}

/** The next field after this one, if the form goes on. */
export function nextField(
    field: HTMLInputElement | HTMLTextAreaElement,
    fields: readonly (HTMLInputElement | HTMLTextAreaElement)[],
): HTMLInputElement | HTMLTextAreaElement | null {
    const index = fields.indexOf(field)
    return index >= 0 ? (fields[index + 1] ?? null) : null
}

/** The keyboard's Enter says what it does: «search», «next» field, or «done». */
function labelEnterKey(field: HTMLInputElement | HTMLTextAreaElement): void {
    if (field instanceof HTMLTextAreaElement || field.getAttribute("enterkeyhint")) {
        return
    }
    field.enterKeyHint = nextField(field, fieldsOnScreen()) ? "next" : "done"
}

/** The focused field stays above the keyboard, never hidden under it. */
function keepAboveKeyboard(field: HTMLElement): void {
    window.setTimeout(() => {
        if (document.activeElement !== field) {
            return
        }
        const visible = window.visualViewport?.height ?? window.innerHeight
        const rect = field.getBoundingClientRect()
        if (rect.bottom > visible - KEYBOARD_GAP_PX || rect.top < 0) {
            field.scrollIntoView({ block: "center", behavior: "smooth" })
        }
    }, KEYBOARD_SETTLE_MS)
}

function onFocus(event: FocusEvent): void {
    const field = event.target as Element | null
    if (isTypingField(field)) {
        labelEnterKey(field)
        keepAboveKeyboard(field)
    }
}

/** Enter in a one-line field: on to the next field, or the keyboard goes away. */
function onKeyDown(event: KeyboardEvent): void {
    const field = event.target as Element | null
    if (event.key !== "Enter" || !(field instanceof HTMLInputElement) || !isTypingField(field)) {
        return
    }
    const next = field.enterKeyHint === "next" ? nextField(field, fieldsOnScreen()) : null
    event.preventDefault()
    if (next) {
        next.focus()
    } else {
        hideKeyboard()
    }
}

/** Once, at start: the keyboard behaves like a native app's. */
export function setUpKeyboard(): void {
    document.addEventListener("focusin", onFocus)
    document.addEventListener("keydown", onKeyDown)
}
