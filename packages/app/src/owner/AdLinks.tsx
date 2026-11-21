import { LINK_LABEL_MAX, SourceLinkKind } from "@zumda/core"
import { useMemo, useState } from "react"

import { useLanguage, useT } from "../i18n/index.js"
import { usePagedList } from "../lib/paged.js"
import { confirm, haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { CheckIcon, CopyIcon, PlusIcon, TrashIcon } from "../ui/icons.js"
import { LoadMore } from "../ui/load-more.js"
import { Button, Field, Segmented, Skeleton, TextInput } from "../ui/primitives.js"
import { Sheet } from "../ui/sheet.js"

import { channelApi } from "./channel-api.js"
import { LinkIcon } from "./channel-icons.js"
import { channelFailToast } from "./channel-state.js"
import { linkCountsText } from "./channel-words.js"
import { ProductPick, useOwnerProducts } from "./product-pick.js"

import type { SourceLinkView } from "./channel-api.js"
import type { ProductDTO } from "@zumda/core"

type Target = "shop" | "product"
const COPIED_MS = 2000

/** One tap copies the link for the ad; where the clipboard is closed, the link is shown. */
function CopyLink({ url }: { url: string }): React.JSX.Element {
    const s = useT().owner.settings
    const [copied, setCopied] = useState(false)
    const copy = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(url)
            haptic.success()
            setCopied(true)
            window.setTimeout(() => setCopied(false), COPIED_MS)
        } catch {
            toast(url)
        }
    }
    return (
        <button
            type="button"
            onClick={(): void => void copy()}
            className="tap flex min-h-11 items-center gap-3 rounded-control bg-tg-bg px-3 py-2 text-left"
        >
            <span className="min-w-0 flex-1 truncate text-sm">{url.replace("https://", "")}</span>
            <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand">
                {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                {copied ? s.copied : s.copy}
            </span>
        </button>
    )
}

/** «Yangi havola»: the ad's name, and whether it opens the whole shop or one product. */
function NewLinkSheet({
    products,
    onCreated,
    onClose,
}: {
    products: readonly ProductDTO[]
    onCreated(link: SourceLinkView): void
    onClose(): void
}): React.JSX.Element {
    const t = useT()
    const a = t.owner.channel.ads
    const [label, setLabel] = useState("")
    const [target, setTarget] = useState<Target>("shop")
    const [productId, setProductId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const create = async (): Promise<void> => {
        const missing = !label.trim()
            ? a.needName
            : target === "product" && !productId
              ? a.needProduct
              : null
        if (missing) {
            haptic.error()
            toast(missing, "error")
            return
        }
        setSaving(true)
        try {
            const link = await channelApi.createLink(
                label.trim(),
                target === "product" ? (productId ?? undefined) : undefined,
            )
            haptic.success()
            toast(a.created, "success")
            onCreated(link)
        } catch (caught) {
            channelFailToast(t, caught)
        } finally {
            setSaving(false)
        }
    }
    return (
        <Sheet
            title={a.create}
            onClose={onClose}
            footer={
                <Button size="lg" loading={saving} onClick={(): void => void create()}>
                    {t.common.save}
                </Button>
            }
        >
            <div className="flex flex-col gap-4">
                <Field label={a.name} htmlFor="ad-link-name" hint={a.nameHint}>
                    <TextInput
                        id="ad-link-name"
                        value={label}
                        maxLength={LINK_LABEL_MAX}
                        placeholder={a.namePlaceholder}
                        onChange={(event): void => setLabel(event.target.value)}
                    />
                </Field>
                <Field label={a.target}>
                    <Segmented<Target>
                        value={target}
                        options={[
                            { value: "shop", label: a.wholeShop },
                            { value: "product", label: a.oneProduct },
                        ]}
                        onChange={setTarget}
                    />
                </Field>
                {target === "product" ? (
                    <ProductPick products={products} picked={productId} onPick={setProductId} />
                ) : null}
            </div>
        </Sheet>
    )
}

function AdLinkRow({
    link,
    product,
    onRemove,
}: {
    link: SourceLinkView
    product: ProductDTO | undefined
    onRemove(): Promise<void>
}): React.JSX.Element {
    const t = useT()
    const a = t.owner.channel.ads
    const language = useLanguage()
    const [removing, setRemoving] = useState(false)
    return (
        <li className="flex animate-rise flex-col gap-2 py-3">
            <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{link.label}</p>
                    {/* A product deleted since: its name is gone, the link still opens the shop. */}
                    {link.productId && !product ? null : (
                        <p className="truncate text-sm text-tg-hint">
                            {product ? product.name : a.wholeShop}
                        </p>
                    )}
                    <p className="text-sm text-tg-subtitle">
                        {linkCountsText(t.owner.channel, link, language)}
                    </p>
                </div>
                <Button
                    variant="ghost"
                    aria-label={a.remove}
                    loading={removing}
                    className="-mr-2 w-11 shrink-0 px-0 text-tg-hint"
                    icon={<TrashIcon size={18} />}
                    onClick={(): void => {
                        setRemoving(true)
                        void onRemove().finally(() => setRemoving(false))
                    }}
                />
            </div>
            <CopyLink url={link.url} />
        </li>
    )
}

/**
 * «Reklama uchun havolalar» (owner's decision, November 2026): a named link for each ad in another
 * channel, to the whole shop or to one product, and what each brought. No channel needed.
 */
export function AdLinks(): React.JSX.Element {
    const t = useT()
    const a = t.owner.channel.ads
    const products = useOwnerProducts()
    const byId = useMemo(
        () => new Map((products ?? []).map((product) => [product.id, product])),
        [products],
    )
    const list = usePagedList("ad-links", (page) => channelApi.links(SourceLinkKind.AD, page))
    const [creating, setCreating] = useState(false)
    const remove = async (link: SourceLinkView): Promise<void> => {
        if (!(await confirm(a.removeConfirm, { yes: a.remove, destructive: true }))) {
            return
        }
        try {
            await channelApi.removeLink(link.id)
            list.update((items) => items.filter((item) => item.id !== link.id))
            haptic.success()
        } catch (caught) {
            channelFailToast(t, caught)
        }
    }
    return (
        <section className="flex flex-col gap-3 rounded-tile bg-tg-secondary p-4">
            <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-control bg-brand/15 text-brand">
                    <LinkIcon size={26} />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="font-semibold">{a.title}</h2>
                    <p className="text-sm text-tg-hint">{a.hint}</p>
                </div>
            </div>
            {list.items === null ? (
                <Skeleton className="h-20 rounded-control" />
            ) : list.items.length === 0 ? (
                <p className="text-sm text-tg-subtitle">{a.empty}</p>
            ) : (
                <ul className="divide-y divide-tg-separator">
                    {list.items.map((link) => (
                        <AdLinkRow
                            key={link.id}
                            link={link}
                            product={link.productId ? byId.get(link.productId) : undefined}
                            onRemove={(): Promise<void> => remove(link)}
                        />
                    ))}
                </ul>
            )}
            <LoadMore list={list} />
            <Button
                variant="surface"
                className="self-start"
                icon={<PlusIcon size={18} />}
                onClick={(): void => {
                    haptic.tap()
                    setCreating(true)
                }}
            >
                {a.create}
            </Button>
            {creating ? (
                <NewLinkSheet
                    products={products ?? []}
                    onClose={(): void => setCreating(false)}
                    onCreated={(link): void => {
                        list.update((items) => [link, ...items])
                        setCreating(false)
                    }}
                />
            ) : null}
        </section>
    )
}
