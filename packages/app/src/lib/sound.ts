/**
 * The Zumda sound (owner's choice, October 2026: «Zum-da»): the two syllables of the name as a
 * rising fifth on a soft bell, G5 then D6. Synthesized with Web Audio: no file to download, the
 * same on every phone. «order» (a new order for the shop or the courier) rings it twice; «status»
 * (the customer's order moved) once, softer.
 */
import { isAppActive } from "./telegram.js"

export type ZumdaSound = "order" | "status"

/** G5 and D6: the "zum" and the "da". */
const ZUM_HZ = 783.99
const DA_HZ = 1174.66
/** The bell's overtones: inharmonic like a real bell, each fading faster than the note. */
const PARTIALS: readonly { ratio: number; level: number; decay: number }[] = [
    { ratio: 1, level: 1, decay: 4.5 },
    { ratio: 2.76, level: 0.35, decay: 13.5 },
    { ratio: 5.4, level: 0.2, decay: 22.5 },
]
const ATTACK_S = 0.006
/** Quieter than zero for an exponential fade: "silent". */
const SILENT = 0.0001

interface Note {
    hz: number
    at: number
    length: number
}

const MOTIF: Record<ZumdaSound, { notes: Note[]; volume: number; repeat: number }> = {
    order: {
        notes: [
            { hz: ZUM_HZ, at: 0, length: 0.5 },
            { hz: DA_HZ, at: 0.16, length: 0.9 },
        ],
        volume: 0.32,
        repeat: 2,
    },
    status: {
        notes: [
            { hz: ZUM_HZ, at: 0, length: 0.35 },
            { hz: DA_HZ, at: 0.12, length: 0.6 },
        ],
        volume: 0.18,
        repeat: 1,
    },
}
/** One "zum-da" lasts this long; a repeat starts after a short breath. */
const MOTIF_S = 1.06
const BREATH_S = 0.25

const SOUND_KEY = "zumda:sound"

let context: AudioContext | null = null

function audio(): AudioContext | null {
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

/** The shop's and the courier's switch («Ovoz»), on unless turned off on this phone. */
export function soundEnabled(): boolean {
    try {
        return window.localStorage.getItem(SOUND_KEY) !== "off"
    } catch {
        return true
    }
}

export function setSoundEnabled(on: boolean): void {
    try {
        window.localStorage.setItem(SOUND_KEY, on ? "on" : "off")
    } catch {
        // Private mode: the switch lasts this session only.
    }
}

function bell(ctx: AudioContext, note: Note, start: number, volume: number): void {
    for (const partial of PARTIALS) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "sine"
        osc.frequency.value = note.hz * partial.ratio
        const peak = volume * partial.level
        gain.gain.setValueAtTime(SILENT, start)
        gain.gain.linearRampToValueAtTime(peak, start + ATTACK_S)
        const end = start + note.length
        gain.gain.exponentialRampToValueAtTime(
            Math.max(SILENT, peak * Math.exp(-partial.decay * note.length)),
            end,
        )
        osc.connect(gain).connect(ctx.destination)
        osc.start(start)
        osc.stop(end + 0.05)
    }
}

/**
 * Rings the Zumda sound, only while the app is on screen (a collapsed app gets the bot's own
 * notification). `respectSwitch`: the shop's and the courier's «Ovoz» may turn it off.
 */
export function playZumda(kind: ZumdaSound, respectSwitch = true): void {
    if (!isAppActive() || (respectSwitch && !soundEnabled())) {
        return
    }
    const ctx = audio()
    if (!ctx) {
        return
    }
    void ctx.resume().catch(() => undefined)
    const motif = MOTIF[kind]
    const begin = ctx.currentTime + 0.02
    for (let round = 0; round < motif.repeat; round++) {
        const offset = begin + round * (MOTIF_S + BREATH_S)
        for (const note of motif.notes) {
            bell(ctx, note, offset + note.at, motif.volume)
        }
    }
}
