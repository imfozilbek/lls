import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App, initialLanguage } from "./App.js"
import { dictionaryFor, useLanguageStore } from "./i18n/index.js"
import { listenForCrashes } from "./lib/crashes.js"
import { setUpKeyboard } from "./lib/keyboard.js"
import { unlockSoundOnFirstTouch } from "./lib/sound.js"
import {
    paintLightFrame,
    readLaunchParams,
    setPopupWords,
    setUpNativeFeel,
    webApp,
} from "./lib/telegram.js"
import { useRouter } from "./stores/router.js"
import { Boundary, CrashScreen } from "./ui/boundary.js"
import "./index.css"

const app = webApp()
app?.ready()
app?.expand()
paintLightFrame(app)
setUpNativeFeel(app)
setUpKeyboard()
unlockSoundOnFirstTouch()
initialLanguage()
const { common } = dictionaryFor(useLanguageStore.getState().language)
setPopupWords({ yes: common.yes, no: common.cancel })

const launch = readLaunchParams(new URL(window.location.href), app)

/** Which part of the app crashed: the mode, and in a shop its screen. */
function screenOf(): string {
    if (launch.courier) {
        return "courier"
    }
    if (launch.business) {
        return "business"
    }
    if (launch.market) {
        return "market"
    }
    const { stack } = useRouter.getState()
    return launch.shop ? `shop:${stack[stack.length - 1]?.name ?? "menu"}` : "web"
}

// Before the first render: a crash while drawing is reported too.
listenForCrashes(screenOf)

/** A reload for a piece gone after a deploy: once in this long, never a loop. */
const RELOAD_GUARD_MS = 10_000
const RELOADED_AT = "zumda:reloaded-at"

// A deploy while the app stayed open removes the old pieces: the page loads the new ones once.
window.addEventListener("vite:preloadError", (event) => {
    try {
        const last = Number(sessionStorage.getItem(RELOADED_AT) ?? 0)
        if (Date.now() - last < RELOAD_GUARD_MS) {
            return
        }
        sessionStorage.setItem(RELOADED_AT, String(Date.now()))
    } catch {
        return
    }
    event.preventDefault()
    window.location.reload()
})

const root = document.getElementById("root")

if (root) {
    createRoot(root).render(
        <StrictMode>
            <Boundary fallback={<CrashScreen />}>
                <App launch={launch} />
            </Boundary>
        </StrictMode>,
    )
}
