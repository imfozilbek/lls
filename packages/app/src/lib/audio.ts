/**
 * The phone's audio for the Zumda sound. Phones play sound only after a touch, so the first tap
 * wakes it at start; the bell itself (`sound.ts`) loads only with the screens that ring it, never
 * in the customer's first download.
 */
let context: AudioContext | null = null

export function audio(): AudioContext | null {
    if (context) {
        return context
    }
    const Ctor = window.AudioContext as typeof AudioContext | undefined
    if (!Ctor) {
        return null
    }
    context = new Ctor()
    return context
}

/**
 * Phones play sound only after a touch: the first tap anywhere wakes the audio, so a new order
 * later in the shift can ring. Once, at start.
 */
export function unlockSoundOnFirstTouch(): void {
    const wake = (): void => {
        void audio()
            ?.resume()
            .catch(() => undefined)
        window.removeEventListener("pointerdown", wake)
        window.removeEventListener("touchend", wake)
    }
    window.addEventListener("pointerdown", wake)
    window.addEventListener("touchend", wake)
}
