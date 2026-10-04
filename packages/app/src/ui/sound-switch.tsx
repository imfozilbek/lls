import { useState } from "react"

import { useT } from "../i18n/index.js"
import { playZumda, setSoundEnabled, soundEnabled } from "../lib/sound.js"

import { Switch } from "./primitives.js"

/**
 * «Zumda ovozi» for the shop and the courier: on by default; turning it on plays the sound once,
 * so they know what a new order sounds like.
 */
export function SoundSwitch(): React.JSX.Element {
    const t = useT().sound
    const [on, setOn] = useState(soundEnabled)
    return (
        <div className="flex items-center gap-3 rounded-tile bg-tg-secondary p-4">
            <div className="min-w-0 flex-1">
                <p className="font-semibold">{t.title}</p>
                <p className="text-sm text-tg-subtitle">{t.hint}</p>
            </div>
            <Switch
                checked={on}
                label={t.title}
                onChange={(next): void => {
                    setOn(next)
                    setSoundEnabled(next)
                    if (next) {
                        playZumda("order")
                    }
                }}
            />
        </div>
    )
}
