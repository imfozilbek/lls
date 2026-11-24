import { STOREFRONT_LAYOUTS, StorefrontLayout } from "@zumda/core"
import { useEffect, useRef, useState } from "react"

import { errorText, useT } from "../i18n/index.js"
import { ApiError, api, imageUrl } from "../lib/api.js"
import { cn } from "../lib/cn.js"
import { compressImage } from "../lib/image.js"
import { confirm, haptic } from "../lib/telegram.js"
import { resolveLayout } from "../shop/menu-layout.js"
import { useRouter } from "../stores/router.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import { CheckIcon, Icon } from "../ui/icons.js"
import { Button, Section } from "../ui/primitives.js"

import type { IconProps } from "../ui/icons.js"
import type { ShopOwnerDTO } from "@zumda/core"

/** A cover is wide: its long side may stay larger than a logo's. */
const COVER_SIDE = 1280

const EyeIcon = (p: IconProps): React.JSX.Element => (
    <Icon {...p}>
        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
        <circle cx="12" cy="12" r="3" />
    </Icon>
)

function failToast(t: ReturnType<typeof useT>, caught: unknown): void {
    haptic.error()
    toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
}

/** A layout drawn small: the page, its cards and their photos, as customers will see them. */
function LayoutSketch({ layout }: { layout: StorefrontLayout }): React.JSX.Element {
    const photo = "rounded-[5px] bg-brand/25"
    const line = "h-1.5 rounded-full bg-tg-hint/25"
    const card = "rounded-[6px] bg-tg-secondary"
    const body = ((): React.JSX.Element => {
        switch (layout) {
            case StorefrontLayout.GRID:
                return (
                    <span className="grid grid-cols-2 gap-1.5">
                        {[0, 1, 2, 3].map((i) => (
                            <span key={i} className={cn(card, "flex flex-col gap-1 p-1")}>
                                <span className={cn(photo, "h-6")} />
                                <span className={cn(line, "w-3/4")} />
                            </span>
                        ))}
                    </span>
                )
            case StorefrontLayout.LIST:
                return (
                    <span className="flex flex-col gap-1.5">
                        {[0, 1, 2].map((i) => (
                            <span key={i} className={cn(card, "flex items-center gap-1.5 p-1")}>
                                <span className={cn(photo, "h-5 w-5 shrink-0")} />
                                <span className="flex flex-1 flex-col gap-1">
                                    <span className={line} />
                                    <span className={cn(line, "w-3/5")} />
                                </span>
                            </span>
                        ))}
                    </span>
                )
            case StorefrontLayout.FEED:
                return (
                    <span className={cn(card, "flex flex-col gap-1 p-1")}>
                        <span className={cn(photo, "h-12")} />
                        <span className={cn(line, "w-4/5")} />
                        <span className={cn(line, "w-2/5")} />
                    </span>
                )
            case StorefrontLayout.SHELVES:
                return (
                    <span className="flex flex-col gap-1">
                        {[0, 1].map((row) => (
                            <span key={row} className="flex flex-col gap-1">
                                <span className={cn(line, "w-1/2")} />
                                <span className="flex gap-1">
                                    {[0, 1, 2].map((i) => (
                                        <span
                                            key={i}
                                            className={cn(card, "w-[38%] shrink-0 p-0.5")}
                                        >
                                            <span className={cn(photo, "block h-5")} />
                                        </span>
                                    ))}
                                </span>
                            </span>
                        ))}
                    </span>
                )
        }
    })()
    return (
        <span
            aria-hidden="true"
            className="block h-[100px] overflow-hidden rounded-[0.75rem] bg-tg-bg p-2"
        >
            {body}
        </span>
    )
}

function LayoutOption({
    layout,
    checked,
    onPick,
}: {
    layout: StorefrontLayout
    checked: boolean
    onPick(layout: StorefrontLayout): void
}): React.JSX.Element {
    const words = useT().owner.settings.look.layouts[layout]
    return (
        <button
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={(): void => onPick(layout)}
            className={cn(
                "tap relative flex flex-col gap-2.5 rounded-tile bg-tg-secondary p-2.5 text-left transition-shadow duration-200",
                checked && "ring-2 ring-brand",
            )}
        >
            <LayoutSketch layout={layout} />
            <span className="px-0.5 pb-0.5">
                <span className="block font-semibold leading-tight">{words.name}</span>
                <span className="mt-1 block text-sm leading-snug text-tg-hint">{words.hint}</span>
            </span>
            {checked ? (
                <span className="absolute right-1.5 top-1.5 grid h-6 w-6 animate-pop place-items-center rounded-full bg-brand text-brand-ink ring-2 ring-tg-secondary">
                    <CheckIcon size={14} strokeWidth={2.75} />
                </span>
            ) : null}
        </button>
    )
}

/**
 * «Vitrina qanday ko'rinadi» (owner's decisions, November 2026; goal 24): four layouts, saved on a
 * tap like a switch. Never chosen, the one the photos give is marked: what customers see now.
 */
function LayoutPicker({
    shop,
    onSaved,
}: {
    shop: ShopOwnerDTO
    onSaved(shop: ShopOwnerDTO): void
}): React.JSX.Element {
    const t = useT()
    const s = t.owner.settings
    const catalog = useSession((state) => state.catalog)
    const [chosen, setChosen] = useState(shop.storefrontLayout)
    // A pull to refresh (or a save elsewhere) brings the shop again: the choice follows it.
    useEffect(() => setChosen(shop.storefrontLayout), [shop.storefrontLayout])
    const shown = resolveLayout(chosen, catalog)
    const pick = async (layout: StorefrontLayout): Promise<void> => {
        if (layout === shown && chosen !== null) {
            return
        }
        const before = chosen
        haptic.select()
        setChosen(layout)
        try {
            onSaved(await api.owner.updateShop({ storefrontLayout: layout }))
            toast(s.saved, "success")
        } catch (caught) {
            setChosen(before)
            failToast(t, caught)
        }
    }
    return (
        <Section>
            <p className="px-1 text-sm text-tg-hint">{s.look.hint}</p>
            <div role="radiogroup" aria-label={s.look.group} className="grid grid-cols-2 gap-3">
                {STOREFRONT_LAYOUTS.map((layout) => (
                    <LayoutOption
                        key={layout}
                        layout={layout}
                        checked={layout === shown}
                        onPick={(next): void => void pick(next)}
                    />
                ))}
            </div>
        </Section>
    )
}

/** «Muqova rasmi»: a wide picture over the storefront; the file is picked by a button. */
function CoverPicker({
    shop,
    onSaved,
}: {
    shop: ShopOwnerDTO
    onSaved(shop: ShopOwnerDTO): void
}): React.JSX.Element {
    const t = useT()
    const look = t.owner.settings.look
    const input = useRef<HTMLInputElement>(null)
    const [busy, setBusy] = useState<"upload" | "remove" | null>(null)
    const cover = imageUrl(shop.coverKey)

    const upload = async (file: File | undefined): Promise<void> => {
        if (!file) {
            return
        }
        setBusy("upload")
        try {
            onSaved(await api.owner.uploadCover(await compressImage(file, COVER_SIDE)))
            haptic.success()
            toast(t.owner.settings.saved, "success")
        } catch (caught) {
            failToast(t, caught)
        } finally {
            setBusy(null)
        }
    }
    const remove = async (): Promise<void> => {
        const yes = await confirm(look.coverRemoveAsk, {
            yes: t.common.delete,
            destructive: true,
        })
        if (!yes) {
            return
        }
        setBusy("remove")
        try {
            onSaved(await api.owner.removeCover())
            haptic.success()
            toast(look.coverRemoved, "success")
        } catch (caught) {
            failToast(t, caught)
        } finally {
            setBusy(null)
        }
    }

    return (
        <Section title={look.cover}>
            <div className="flex flex-col gap-3 rounded-tile bg-tg-secondary p-3">
                {cover ? (
                    <img
                        src={cover}
                        alt=""
                        className="aspect-[5/2] w-full animate-pop rounded-control bg-tg-bg object-cover"
                    />
                ) : null}
                <p className="px-1 text-sm text-tg-hint">{look.coverHint}</p>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="surface"
                        className="flex-1"
                        loading={busy === "upload"}
                        disabled={busy !== null}
                        onClick={(): void => input.current?.click()}
                    >
                        {cover ? look.coverChange : look.coverAdd}
                    </Button>
                    {cover ? (
                        <Button
                            variant="quietDanger"
                            loading={busy === "remove"}
                            disabled={busy !== null}
                            onClick={(): void => void remove()}
                        >
                            {look.coverRemove}
                        </Button>
                    ) : null}
                </div>
                <input
                    ref={input}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event): void => {
                        void upload(event.target.files?.[0])
                        event.target.value = ""
                    }}
                />
            </div>
        </Section>
    )
}

/** «Mijozlar shunday ko'radi»: the storefront itself, Back returns here. */
function PreviewButton(): React.JSX.Element {
    const look = useT().owner.settings.look
    return (
        <Button
            variant="secondary"
            size="lg"
            className="w-full text-brand"
            icon={<EyeIcon size={20} />}
            onClick={(): void => {
                haptic.tap()
                useRouter.getState().push({ name: "menu" })
                window.scrollTo({ top: 0 })
            }}
        >
            {look.preview}
        </Button>
    )
}

/** The storefront's look: its layout, its cover, and a look at it as customers see it. */
export function LookSection({
    shop,
    onSaved,
}: {
    shop: ShopOwnerDTO
    onSaved(shop: ShopOwnerDTO): void
}): React.JSX.Element {
    return (
        <>
            <LayoutPicker shop={shop} onSaved={onSaved} />
            <CoverPicker shop={shop} onSaved={onSaved} />
            <PreviewButton />
        </>
    )
}
