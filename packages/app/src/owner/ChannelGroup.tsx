import { SourceLinkKind } from "@zumda/core"
import { useEffect, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { formatTime } from "../lib/format.js"
import { usePagedList } from "../lib/paged.js"
import { useRefresh } from "../lib/refresh.js"
import { confirm, haptic, openTelegramLink } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { LoadMore } from "../ui/load-more.js"
import { Button, Section, Skeleton, Spinner } from "../ui/primitives.js"
import { ProductImage } from "../ui/product-image.js"

import { channelApi } from "./channel-api.js"
import { MegaphoneIcon } from "./channel-icons.js"
import { channelFailToast, useShopChannel } from "./channel-state.js"
import { linkCountsText } from "./channel-words.js"
import { useOwner } from "./store.js"

import type { ChannelInfo, SourceLinkView } from "./channel-api.js"
import type { ShopChannelState } from "./channel-state.js"
import type { ProductDTO, ShopOwnerDTO } from "@zumda/core"

/** The owner's products, loaded once: a post and a link show the product they lead to. */
export function useOwnerProducts(): readonly ProductDTO[] | null {
    const products = useOwner((state) => state.products)
    const loadProducts = useOwner((state) => state.loadProducts)
    useEffect(() => {
        if (products === null) {
            loadProducts().catch(() => undefined)
        }
    }, [products, loadProducts])
    return products
}

/** «Kanalni bog'lash» and, while the owner is on Telegram's screen, that the app is waiting. */
export function ConnectChannel({ state }: { state: ShopChannelState }): React.JSX.Element {
    const c = useT().owner.channel
    return (
        <div className="flex flex-col gap-3">
            <Button
                size="lg"
                loading={state.connecting}
                icon={<MegaphoneIcon size={20} />}
                onClick={(): void => void state.connect()}
            >
                {c.connect}
            </Button>
            {state.waiting ? (
                <p
                    className="flex animate-fade-in items-center gap-2 rounded-control bg-brand/10 p-3 text-sm"
                    role="status"
                >
                    <Spinner className="shrink-0 text-brand" />
                    {c.waiting}
                </p>
            ) : (
                <p className="px-1 text-sm text-tg-hint">{c.connectHint}</p>
            )}
        </div>
    )
}

function NotConnected({
    shop,
    state,
}: {
    shop: ShopOwnerDTO
    state: ShopChannelState
}): React.JSX.Element {
    const t = useT()
    const c = t.owner.channel
    if (shop.demo) {
        return (
            <p className="rounded-tile bg-tg-secondary p-4 text-sm text-tg-subtitle">
                {errorText(t, "DEMO_NOT_PROMOTED")}
            </p>
        )
    }
    return (
        <section className="flex animate-rise flex-col gap-4 rounded-tile bg-tg-secondary p-4">
            <span className="grid h-12 w-12 place-items-center rounded-control bg-brand/15 text-brand">
                <MegaphoneIcon size={26} />
            </span>
            <p>{c.intro}</p>
            <ConnectChannel state={state} />
            <p className="px-1 text-sm text-tg-hint">{c.alreadyAdmin}</p>
        </section>
    )
}

function ChannelCard({ info }: { info: ChannelInfo }): React.JSX.Element {
    const c = useT().owner.channel
    const facts = [
        info.username ? `@${info.username}` : null,
        info.subscribers === null ? null : fill(c.subscribers, { n: String(info.subscribers) }),
    ].filter(Boolean)
    return (
        <section className="flex animate-rise items-center gap-4 rounded-tile bg-tg-secondary p-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
                <MegaphoneIcon size={24} />
            </span>
            <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold">{info.title}</h2>
                {facts.length > 0 ? (
                    <p className="truncate text-sm text-tg-hint">{facts.join(" · ")}</p>
                ) : null}
            </div>
        </section>
    )
}

function PostRow({
    post,
    product,
    onDelete,
}: {
    post: SourceLinkView
    product: ProductDTO | undefined
    onDelete(): Promise<void>
}): React.JSX.Element {
    const t = useT()
    const c = t.owner.channel
    const language = useLanguage()
    const [deleting, setDeleting] = useState(false)
    const name = product?.name ?? c.post.button
    return (
        <li className="flex flex-col gap-3 py-3">
            <div className="flex items-start gap-3">
                <ProductImage
                    imageKey={product?.imageKey}
                    category={product?.category ?? "other"}
                    alt={name}
                    name={product?.name}
                    iconSize={20}
                    className="h-14 w-14 shrink-0 rounded-control"
                />
                <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{name}</p>
                    <p className="text-sm text-tg-hint">{formatTime(post.createdAt, language)}</p>
                    <p className="text-sm text-tg-subtitle">{linkCountsText(c, post, language)}</p>
                </div>
            </div>
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
            </div>
        </li>
    )
}

/** The posts Zumda made in the channel of now, newest first, with what each brought. */
function ChannelPosts({
    info,
    reloadChannel,
}: {
    info: ChannelInfo
    reloadChannel(): Promise<void>
}): React.JSX.Element {
    const t = useT()
    const c = t.owner.channel
    const products = useOwnerProducts()
    const byId = new Map((products ?? []).map((product) => [product.id, product]))
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
        <Section title={c.posts}>
            <p className="-mt-1 px-1 text-sm text-tg-hint">{c.syncHint}</p>
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
                        />
                    ))}
                </ul>
            )}
            <LoadMore list={list} />
        </Section>
    )
}

/**
 * «Telegram kanal» in «Sozlamalar» (owner's decision, November 2026): the shop's bot becomes the
 * channel's admin from Telegram's own screen; then every product goes to the channel with one
 * button, and each post says how many came, ordered and got it.
 */
export function ChannelGroup({ shop }: { shop: ShopOwnerDTO }): React.JSX.Element {
    const t = useT()
    const c = t.owner.channel
    const state = useShopChannel()
    const { info, load } = state
    const [leaving, setLeaving] = useState(false)
    // Once on opening (a copy from this session shows meanwhile); the pull asks again.
    useEffect(() => {
        load().catch((caught: unknown) => channelFailToast(t, caught))
    }, [load, t])
    useRefresh(load)
    const disconnect = async (): Promise<void> => {
        const options = { yes: c.disconnect, destructive: true }
        if (!(await confirm(c.disconnectConfirm, options))) {
            return
        }
        setLeaving(true)
        try {
            await channelApi.disconnect()
            state.set(null)
            haptic.success()
            toast(c.disconnected, "success")
        } catch (caught) {
            channelFailToast(t, caught)
        } finally {
            setLeaving(false)
        }
    }
    if (info === undefined) {
        return <Skeleton className="h-40 rounded-tile" />
    }
    if (info === null) {
        return <NotConnected shop={shop} state={state} />
    }
    return (
        <>
            <ChannelCard info={info} />
            <ChannelPosts info={info} reloadChannel={load} />
            <Button
                variant="quietDanger"
                className="self-start"
                loading={leaving}
                onClick={(): void => void disconnect()}
            >
                {c.disconnect}
            </Button>
        </>
    )
}
