import { SourceLinkKind, SourceLinkOrigin } from "@zumda/core"
import { useEffect, useRef, useState } from "react"

import { fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError } from "../lib/api.js"
import { formatTime } from "../lib/format.js"
import { usePagedList } from "../lib/paged.js"
import { useRefresh } from "../lib/refresh.js"
import { confirm, haptic, openTelegramLink } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { CheckIcon } from "../ui/icons.js"
import { LoadMore } from "../ui/load-more.js"
import { Button, Field, Section, Segmented, Skeleton, Spinner } from "../ui/primitives.js"
import { ProductImage } from "../ui/product-image.js"
import { Sheet } from "../ui/sheet.js"

import { channelApi } from "./channel-api.js"
import { channelFailToast } from "./channel-state.js"
import { linkCountsText, postLines } from "./channel-words.js"
import { ProductPick, useOwnerProducts } from "./product-pick.js"

import type { ChannelInfo, SourceLinkView } from "./channel-api.js"
import type { PagedList } from "../lib/paged.js"
import type { ProductDTO } from "@zumda/core"

type Target = "shop" | "product"
const SECOND_MS = 1000
/** Our own limit answered: the next press after this long. */
const LIMIT_WAIT_S = 30

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/** «Tugmasi bor» or «Tugmasi yo'q» under a post the owner made in Telegram. */
function ButtonBadge({ set }: { set: boolean }): React.JSX.Element {
    const c = useT().owner.channel
    return set ? (
        <span className="inline-flex items-center gap-1 self-start rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold">
            <CheckIcon size={14} className="text-success" />
            {c.buttonSet}
        </span>
    ) : (
        <span className="inline-flex self-start rounded-full bg-tg-bg px-2.5 py-1 text-xs font-semibold text-tg-subtitle">
            {c.buttonNotSet}
        </span>
    )
}

/** What the post is, where it came from, where its button leads and what it brought. */
function PostFacts({
    post,
    product,
    own,
}: {
    post: SourceLinkView
    product: ProductDTO | undefined
    own: boolean
}): React.JSX.Element {
    const c = useT().owner.channel
    const language = useLanguage()
    const lines = postLines(c, post, product?.name)
    return (
        <div className="flex items-start gap-3">
            <ProductImage
                imageKey={product?.imageKey}
                category={product?.category ?? "other"}
                alt={lines.title}
                name={product?.name}
                iconSize={20}
                className="h-14 w-14 shrink-0 rounded-control"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className={own ? "line-clamp-2 font-semibold" : "truncate font-semibold"}>
                    {lines.title}
                </p>
                <p className="text-sm text-tg-hint">
                    {formatTime(post.createdAt, language)} · {lines.source}
                </p>
                {lines.target ? (
                    <p className="truncate text-sm text-tg-subtitle">{lines.target}</p>
                ) : null}
                <p className="text-sm text-tg-subtitle">{linkCountsText(c, post, language)}</p>
                {own ? <ButtonBadge set={post.button} /> : null}
            </div>
        </div>
    )
}

function PostRow({
    post,
    product,
    onDelete,
    onRelink,
}: {
    post: SourceLinkView
    product: ProductDTO | undefined
    onDelete(): Promise<void>
    onRelink(): void
}): React.JSX.Element {
    const c = useT().owner.channel
    const [deleting, setDeleting] = useState(false)
    const own = post.origin === SourceLinkOrigin.CHANNEL
    return (
        <li className="flex flex-col gap-3 py-3">
            <PostFacts post={post} product={product} own={own} />
            {own && !post.button ? (
                <p className="-mt-1 text-sm text-tg-hint">{c.noButtonHint}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
                {post.postUrl ? (
                    <Button
                        variant="secondary"
                        onClick={(): void => {
                            haptic.tap()
                            openTelegramLink(post.postUrl ?? "")
                        }}
                    >
                        {c.openPost}
                    </Button>
                ) : null}
                {own ? (
                    // Zumda never deletes the owner's own post (owner's decision): it leads elsewhere.
                    <Button
                        variant="secondary"
                        onClick={(): void => {
                            haptic.tap()
                            onRelink()
                        }}
                    >
                        {c.pickProduct}
                    </Button>
                ) : (
                    <Button
                        variant="quietDanger"
                        loading={deleting}
                        onClick={(): void => {
                            setDeleting(true)
                            void onDelete().finally(() => setDeleting(false))
                        }}
                    >
                        {c.deletePost}
                    </Button>
                )}
            </div>
        </li>
    )
}

/** «Mahsulotni tanlash»: the button under the owner's post leads to one product or the shop. */
function RelinkSheet({
    post,
    products,
    onSaved,
    onClose,
}: {
    post: SourceLinkView
    products: readonly ProductDTO[]
    onSaved(post: SourceLinkView): void
    onClose(): void
}): React.JSX.Element {
    const t = useT()
    const c = t.owner.channel
    const [target, setTarget] = useState<Target>(post.productId ? "product" : "shop")
    const [productId, setProductId] = useState<string | null>(post.productId ?? null)
    const [saving, setSaving] = useState(false)
    const save = async (): Promise<void> => {
        if (target === "product" && !productId) {
            haptic.error()
            toast(c.ads.needProduct, "error")
            return
        }
        setSaving(true)
        try {
            const saved = await channelApi.relink(post.id, target === "product" ? productId : null)
            haptic.success()
            toast(saved.productId ? c.relinked : c.relinkedShop, "success")
            onSaved(saved)
        } catch (caught) {
            channelFailToast(t, caught)
        } finally {
            setSaving(false)
        }
    }
    return (
        <Sheet
            title={c.pickTitle}
            onClose={onClose}
            footer={
                <Button size="lg" loading={saving} onClick={(): void => void save()}>
                    {t.common.save}
                </Button>
            }
        >
            <div className="flex flex-col gap-4">
                {post.preview ? (
                    <p className="line-clamp-3 rounded-control bg-tg-secondary p-3 text-sm text-tg-subtitle">
                        {post.preview}
                    </p>
                ) : null}
                <Field label={c.ads.target}>
                    <Segmented<Target>
                        value={target}
                        options={[
                            { value: "shop", label: c.ads.wholeShop },
                            { value: "product", label: c.ads.oneProduct },
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

type Progress = { added: number; wait: number | null } | null

/**
 * One press of «Eski postlarni ham qo'shish»: page after page, ten posts a request, until the
 * first post; Telegram asking to wait (or our own limit) is waited out here. Leaving the screen
 * stops it; the next press goes on where it stopped (the server keeps the place).
 */
function useHistoryImport(
    info: ChannelInfo,
    list: PagedList<SourceLinkView>,
    setInfo: (info: ChannelInfo) => void,
): { progress: Progress; run(): Promise<void> } {
    const t = useT()
    const [progress, setProgress] = useState<Progress>(null)
    // Mounted again (React's dev double run, a screen shown again): the loop may go on.
    const alive = useRef(true)
    useEffect(() => {
        alive.current = true
        return (): void => {
            alive.current = false
        }
    }, [])
    const waitOut = async (seconds: number, added: number): Promise<void> => {
        for (let left = seconds; left > 0 && alive.current; left--) {
            setProgress({ added, wait: left })
            await sleep(SECOND_MS)
        }
        setProgress({ added, wait: null })
    }
    const run = async (): Promise<void> => {
        let added = 0
        setProgress({ added, wait: null })
        while (alive.current) {
            try {
                const outcome = await channelApi.history()
                added += outcome.added
                setProgress({ added, wait: null })
                if (outcome.added > 0) {
                    await list.reload()
                }
                if (outcome.kind === "done" || outcome.kind === "unavailable") {
                    setInfo({ ...info, history: outcome.kind })
                    haptic.success()
                    break
                }
                if (outcome.kind === "wait") {
                    await waitOut(outcome.seconds, added)
                }
            } catch (caught) {
                if (caught instanceof ApiError && caught.code === "TOO_MANY_REQUESTS") {
                    await waitOut(LIMIT_WAIT_S, added)
                    continue
                }
                channelFailToast(t, caught)
                break
            }
        }
        if (alive.current) {
            setProgress(null)
        }
    }
    return { progress, run }
}

/** «Eski postlar» (owner's decision, November 2026: the bot reads the channel's past itself). */
function OldPosts({
    info,
    list,
    setInfo,
}: {
    info: ChannelInfo
    list: PagedList<SourceLinkView>
    setInfo(info: ChannelInfo): void
}): React.JSX.Element {
    const h = useT().owner.channel.history
    const { progress, run } = useHistoryImport(info, list, setInfo)
    if (info.history !== "open") {
        return (
            <Section title={h.title}>
                <p className="flex items-center gap-2 rounded-tile bg-tg-secondary p-4 text-sm text-tg-subtitle">
                    {info.history === "done" ? (
                        <CheckIcon size={18} className="shrink-0 text-brand" />
                    ) : null}
                    {info.history === "done" ? h.done : h.unavailable}
                </p>
            </Section>
        )
    }
    return (
        <Section title={h.title}>
            <div className="flex flex-col gap-3 rounded-tile bg-tg-secondary p-4">
                <p className="text-sm text-tg-subtitle">{h.hint}</p>
                <Button
                    variant="secondary"
                    disabled={progress !== null}
                    onClick={(): void => {
                        haptic.tap()
                        void run()
                    }}
                >
                    {h.start}
                </Button>
                {progress ? (
                    <p className="flex animate-fade-in items-start gap-2 text-sm" role="status">
                        <Spinner className="mt-0.5 shrink-0 text-brand" />
                        <span>
                            {progress.wait === null
                                ? h.going
                                : fill(h.wait, { s: String(progress.wait) })}
                            {progress.added > 0 ? (
                                <span className="block font-semibold">
                                    {fill(h.added, { n: String(progress.added) })}
                                </span>
                            ) : null}
                        </span>
                    </p>
                ) : null}
            </div>
        </Section>
    )
}

/**
 * Every post of the channel of now, newest first, with what each brought (owner's decision,
 * November 2026): Zumda's own («Kanalga joylash») and the ones the owner made in Telegram.
 */
export function ChannelPosts({
    info,
    reloadChannel,
    setInfo,
}: {
    info: ChannelInfo
    reloadChannel(): Promise<void>
    setInfo(info: ChannelInfo): void
}): React.JSX.Element {
    const t = useT()
    const c = t.owner.channel
    const products = useOwnerProducts()
    const byId = new Map((products ?? []).map((product) => [product.id, product]))
    const [relinking, setRelinking] = useState<SourceLinkView | null>(null)
    const list = usePagedList(`channel-posts:${info.connectedAt}`, (page) =>
        channelApi.links(SourceLinkKind.POST, page),
    )
    // The pull: the posts' counts and the channel's subscribers together.
    useRefresh(() => Promise.all([list.refresh(), reloadChannel()]))
    const remove = async (post: SourceLinkView): Promise<void> => {
        if (!(await confirm(c.deletePostConfirm, { yes: t.common.delete, destructive: true }))) {
            return
        }
        try {
            await channelApi.removeLink(post.id)
            list.update((items) => items.filter((item) => item.id !== post.id))
            haptic.success()
            toast(c.postDeleted, "success")
        } catch (caught) {
            channelFailToast(t, caught)
        }
    }
    return (
        <>
            <Section title={c.posts}>
                <p className="-mt-1 px-1 text-sm text-tg-hint">{c.autoHint}</p>
                {list.items === null ? (
                    <Skeleton className="h-24 rounded-tile" />
                ) : list.items.length === 0 ? (
                    <p className="rounded-tile bg-tg-secondary p-4 text-sm text-tg-subtitle">
                        {c.noPosts}
                    </p>
                ) : (
                    <ul className="divide-y divide-tg-separator rounded-tile bg-tg-secondary px-4">
                        {list.items.map((post) => (
                            <PostRow
                                key={post.id}
                                post={post}
                                product={post.productId ? byId.get(post.productId) : undefined}
                                onDelete={(): Promise<void> => remove(post)}
                                onRelink={(): void => setRelinking(post)}
                            />
                        ))}
                    </ul>
                )}
                <LoadMore list={list} />
                <p className="px-1 text-sm text-tg-hint">{c.syncHint}</p>
            </Section>
            <OldPosts info={info} list={list} setInfo={setInfo} />
            {relinking && products ? (
                <RelinkSheet
                    post={relinking}
                    products={products}
                    onClose={(): void => setRelinking(null)}
                    onSaved={(saved): void => {
                        list.update((items) =>
                            items.map((item) => (item.id === saved.id ? saved : item)),
                        )
                        setRelinking(null)
                    }}
                />
            ) : null}
        </>
    )
}
