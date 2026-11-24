import { useT } from "../i18n/index.js"
import { navAppsFor, openNavApp, rememberNavApp } from "../lib/nav-apps.js"
import { haptic } from "../lib/telegram.js"

import { Sheet } from "./sheet.js"

import type { RoutePoint } from "@zumda/core"

const TILE_FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"

/**
 * «Yo'lni ochish» (owner's decision, November 2026): the route in the courier's own navigation
 * app. The one picked last stands first; an app that cannot take several stops is not offered.
 */
export function NavAppsSheet({
    stops,
    onClose,
}: {
    stops: readonly RoutePoint[]
    onClose(): void
}): React.JSX.Element {
    const t = useT()
    return (
        <Sheet title={t.courier.route} onClose={onClose}>
            <ul className="grid grid-cols-2 gap-2">
                {navAppsFor(stops).map(({ app, url }, index) => (
                    <li
                        key={app.id}
                        className="animate-rise"
                        style={{ animationDelay: `${index * 40}ms` }}
                    >
                        <button
                            type="button"
                            onClick={(): void => {
                                haptic.tap()
                                rememberNavApp(app.id)
                                openNavApp(url)
                                onClose()
                            }}
                            className={`tap flex min-h-[96px] w-full flex-col items-center justify-center gap-2 rounded-control bg-tg-secondary px-2 py-3 font-semibold ${TILE_FOCUS}`}
                        >
                            <img
                                src={app.icon}
                                alt=""
                                width={48}
                                height={48}
                                decoding="async"
                                className="h-12 w-12 rounded-[0.75rem] shadow-card"
                            />
                            <span>{app.name}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </Sheet>
    )
}
