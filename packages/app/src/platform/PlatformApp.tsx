import { useState } from "react"

import { useT } from "../i18n/index.js"
import { useBackButton } from "../lib/main-button.js"
import { ShieldIcon } from "../ui/icons.js"
import { PoweredBy, Segmented } from "../ui/primitives.js"
import { Settle } from "../ui/settle.js"
import { BottomSpacer } from "../ui/shell.js"

import { DistrictsTab } from "./DistrictsTab.js"
import { ApplicationsTab, ShopsTab } from "./ShopsTabs.js"

import type { AdminTarget } from "../lib/telegram.js"

type PlatformTab = "applications" | "shops" | "districts"

function firstTab(target: AdminTarget | null): PlatformTab {
    return target === "districts" ? "districts" : "applications"
}

/**
 * «Platforma»: what platform admins once did with bot commands. Applications, live and turned-off
 * shops (showcase deal, the bot, on and off), and the districts of the delivery network.
 * A bot message may open it on one of them (`target`). Its own chunk: owners never load it.
 */
export function PlatformApp({
    target,
    onExit,
}: {
    target: AdminTarget | null
    onExit(): void
}): React.JSX.Element {
    const t = useT().platform
    useBackButton(onExit)
    const [tab, setTab] = useState<PlatformTab>(firstTab(target))
    const focusId = target !== null && typeof target === "object" ? target.shopId : null
    // A shop from a message may already be live or off: «Arizalar» hands it to «Bizneslar».
    const [shopsFilter, setShopsFilter] = useState<"active" | "disabled">("active")
    const [stamp, setStamp] = useState(0)
    return (
        <main className="flex flex-col gap-4 px-4 pt-4">
            <header className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-control bg-brand/15 text-brand">
                    <ShieldIcon size={24} />
                </span>
                <div>
                    <h1 className="text-xl font-bold">{t.title}</h1>
                    <p className="text-sm text-tg-hint">{t.entryHint}</p>
                </div>
            </header>
            <Segmented<PlatformTab>
                value={tab}
                onChange={setTab}
                options={[
                    { value: "applications", label: t.tabs.applications },
                    { value: "shops", label: t.tabs.shops },
                    { value: "districts", label: t.tabs.districts },
                ]}
            />
            <Settle key={tab} id={`platform:${tab}`} className="animate-screen-in">
                {tab === "applications" ? (
                    <ApplicationsTab
                        focusId={focusId}
                        onChanged={(): void => setStamp((n) => n + 1)}
                        onFocusElsewhere={(status): void => {
                            setShopsFilter(status)
                            setTab("shops")
                        }}
                    />
                ) : null}
                {tab === "shops" ? (
                    <ShopsTab key={stamp} focusId={focusId} initialFilter={shopsFilter} />
                ) : null}
                {tab === "districts" ? <DistrictsTab /> : null}
            </Settle>
            <PoweredBy />
            <BottomSpacer />
        </main>
    )
}
