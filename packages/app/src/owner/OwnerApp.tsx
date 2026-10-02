import { useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { haptic } from "../lib/telegram.js"
import { useSession } from "../stores/session.js"
import { BagIcon, CashIcon, GearIcon, ListIcon } from "../ui/icons.js"

import { MenuTab } from "./MenuTab.js"
import { MoneyTab } from "./MoneyTab.js"
import { OrdersTab } from "./OrdersTab.js"
import { SettingsTab } from "./SettingsTab.js"
import { useOwner } from "./store.js"

import type { OwnerTab } from "./store.js"
import type { ReactNode } from "react"

const TABS: readonly { id: OwnerTab; icon: (size: number) => ReactNode }[] = [
    { id: "orders", icon: (s) => <ListIcon size={s} /> },
    { id: "menu", icon: (s) => <BagIcon size={s} /> },
    { id: "money", icon: (s) => <CashIcon size={s} /> },
    { id: "settings", icon: (s) => <GearIcon size={s} /> },
]

function TabBar({
    tab,
    onChange,
}: {
    tab: OwnerTab
    onChange(tab: OwnerTab): void
}): React.JSX.Element {
    const t = useT()
    return (
        <nav
            className="sticky top-0 z-sticky grid grid-cols-4 gap-1 bg-tg-bg/95 px-3 py-2 backdrop-blur"
            role="tablist"
        >
            {TABS.map((item) => (
                <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={item.id === tab}
                    onClick={(): void => {
                        haptic.select()
                        onChange(item.id)
                    }}
                    className={cn(
                        "tap flex flex-col items-center gap-0.5 rounded-control py-1.5 text-xs font-semibold transition-colors duration-200",
                        item.id === tab ? "bg-brand/15 text-tg-text" : "text-tg-hint",
                    )}
                >
                    <span className={item.id === tab ? "text-brand" : undefined}>
                        {item.icon(22)}
                    </span>
                    {t.owner.tabs[item.id]}
                </button>
            ))}
        </nav>
    )
}

/** "Мой магазин": the owner's side of the same Mini App. Loaded only when an owner opens it. */
export function OwnerApp(): React.JSX.Element {
    const shop = useSession((state) => state.shop)
    const tab = useOwner((state) => state.tab)
    const setTab = useOwner((state) => state.setTab)
    return (
        <div>
            <header className="px-4 pt-4">
                <h1 className="truncate text-xl font-bold">{shop?.name}</h1>
            </header>
            <TabBar tab={tab} onChange={setTab} />
            <div key={tab} className="animate-fade-in">
                {tab === "orders" ? <OrdersTab /> : null}
                {tab === "menu" ? <MenuTab /> : null}
                {tab === "money" ? <MoneyTab /> : null}
                {tab === "settings" ? <SettingsTab /> : null}
            </div>
        </div>
    )
}
