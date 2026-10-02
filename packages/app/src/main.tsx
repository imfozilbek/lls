import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App, initialLanguage } from "./App.js"
import { readLaunchParams, webApp } from "./lib/telegram.js"
import "./index.css"

const app = webApp()
app?.ready()
app?.expand()
initialLanguage()

const launch = readLaunchParams(new URL(window.location.href), app)

const root = document.getElementById("root")

if (root) {
    createRoot(root).render(
        <StrictMode>
            <App launch={launch} />
        </StrictMode>,
    )
}
