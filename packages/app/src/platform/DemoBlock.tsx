import { BusinessType } from "@zumda/core"
import { useState } from "react"

import { fill, useT } from "../i18n/index.js"
import { adminApi } from "../lib/api.js"
import { confirm, haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { Button } from "../ui/primitives.js"

import { useBusy } from "./shared.js"

import type { DemoTemplateKey, PlatformShopDTO } from "@zumda/core"

/** The samples a shop of this kind may be filled from: a grocery store may be the water one. */
function templatesFor(type: BusinessType): DemoTemplateKey[] {
    switch (type) {
        case BusinessType.FOOD:
            return ["food"]
        case BusinessType.GROCERY:
            return ["grocery", "water"]
        case BusinessType.SERVICE:
            return ["service"]
        case BusinessType.STORE:
            return ["store"]
    }
}

/**
 * «Namuna» in «Platforma»: a live shop becomes a demo (asked first, there is no way back), and a
 * demo starts again with «Namunani tozalash».
 */
export function DemoBlock({
    shop,
    onDone,
}: {
    shop: PlatformShopDTO
    onDone(): void
}): React.JSX.Element {
    const t = useT()
    const p = t.platform
    const { busy, run } = useBusy()
    const [picking, setPicking] = useState(false)
    const make = (template: DemoTemplateKey): Promise<void> =>
        run("demo", async () => {
            const sure = await confirm(fill(p.demoConfirm, { shop: shop.name }), {
                yes: p.demoMake,
            })
            if (!sure) {
                return
            }
            await adminApi.demo(shop.id, template)
            haptic.success()
            toast(fill(p.demoDone, { shop: shop.name }), "success")
            onDone()
        })
    const reset = (): Promise<void> =>
        run("reset", async () => {
            const sure = await confirm(fill(p.demoResetConfirm, { shop: shop.name }), {
                yes: p.demoReset,
                destructive: true,
            })
            if (!sure) {
                return
            }
            await adminApi.resetDemo(shop.id)
            haptic.success()
            toast(p.demoResetDone, "success")
            onDone()
        })

    if (shop.demo) {
        return (
            <div className="flex flex-col gap-2 rounded-control bg-warning/15 p-3">
                <p className="text-sm">
                    <span className="mr-2 rounded-full bg-warning/25 px-2 py-0.5 text-xs font-semibold">
                        {p.demoBadge}
                    </span>
                    {p.demoHint}
                </p>
                <Button
                    variant="surface"
                    loading={busy === "reset"}
                    onClick={(): void => void reset()}
                >
                    {p.demoReset}
                </Button>
            </div>
        )
    }
    const templates = templatesFor(shop.type)
    if (picking && templates.length > 1) {
        return (
            <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-tg-subtitle">{p.demoPick}</p>
                <div className="flex flex-wrap gap-2">
                    {templates.map((template) => (
                        <Button
                            key={template}
                            variant="surface"
                            className="grow"
                            loading={busy === "demo"}
                            onClick={(): void => void make(template)}
                        >
                            {p.demoTemplates[template]}
                        </Button>
                    ))}
                </div>
            </div>
        )
    }
    return (
        <Button
            variant="surface"
            loading={busy === "demo"}
            onClick={(): void => {
                const [only] = templates
                if (templates.length === 1 && only) {
                    void make(only)
                } else {
                    setPicking(true)
                }
            }}
        >
            {p.demoMake}
        </Button>
    )
}
