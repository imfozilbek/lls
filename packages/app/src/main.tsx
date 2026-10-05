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

const root = document.getElementById("root")

if (root) {
    createRoot(root).render(
        <StrictMode>
            <App launch={launch} />
        </StrictMode>,
    )
}
