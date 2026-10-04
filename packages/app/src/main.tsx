import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App, initialLanguage } from "./App.js"
import { dictionaryFor, useLanguageStore } from "./i18n/index.js"
import { setUpKeyboard } from "./lib/keyboard.js"
import {
    paintLightFrame,
    readLaunchParams,
    setPopupWords,
    setUpNativeFeel,
    webApp,
} from "./lib/telegram.js"
import "./index.css"

const app = webApp()
app?.ready()
app?.expand()
paintLightFrame(app)
setUpNativeFeel(app)
setUpKeyboard()
initialLanguage()
const { common } = dictionaryFor(useLanguageStore.getState().language)
setPopupWords({ yes: common.yes, no: common.cancel })

const launch = readLaunchParams(new URL(window.location.href), app)

const root = document.getElementById("root")

if (root) {
    createRoot(root).render(
        <StrictMode>
            <App launch={launch} />
        </StrictMode>,
    )
}
