import { POST_TEXT_MAX } from "@zumda/core"
import { useEffect, useState } from "react"

import { useLanguage, useT } from "../i18n/index.js"
import { ApiError, imageUrl } from "../lib/api.js"
import { haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { Button, Field, Skeleton, TextArea } from "../ui/primitives.js"
import { Sheet } from "../ui/sheet.js"

import { ConnectChannel } from "./ChannelGroup.js"
import { channelApi } from "./channel-api.js"
import { channelFailToast, useShopChannel } from "./channel-state.js"
import { postPreview } from "./channel-words.js"
import { drawPostPhoto } from "./post-photo.js"

import type { ChannelInfo } from "./channel-api.js"
import type { ProductDTO } from "@zumda/core"

/** The post as the channel will show it: the photo, the name, the words, the price, the button. */
function PostPreview({
    channel,
    product,
    text,
}: {
    channel: ChannelInfo
    product: ProductDTO
    text: string
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const preview = postPreview(product, t, language)
    const photo = imageUrl(product.imageKey)
    return (
        <figure className="flex flex-col gap-1.5" aria-label={t.owner.channel.post.preview}>
            <figcaption className="px-1 text-sm font-medium text-tg-subtitle">
                {t.owner.channel.post.preview}
            </figcaption>
            <div className="overflow-hidden rounded-tile bg-tg-secondary">
                <p className="truncate px-3 pt-2.5 text-sm font-semibold text-brand">
                    {channel.title}
                </p>
                {photo ? (
                    <img
                        src={photo}
                        alt={product.name}
                        className="mt-2 max-h-64 w-full bg-tg-bg object-cover"
                    />
                ) : null}
                <div className="flex flex-col gap-2 whitespace-pre-line break-words px-3 py-2.5">
                    <p className="font-bold">{preview.name}</p>
                    {text.trim() ? <p>{text.trim()}</p> : null}
                    <p>
                        {preview.price}
                        {preview.age ? `\n${preview.age}` : ""}
                    </p>
                </div>
                <p className="border-t border-tg-separator py-2.5 text-center text-sm font-semibold text-brand">
                    {t.owner.channel.post.orderButton}
                </p>
            </div>
        </figure>
    )
}

/**
 * «Kanalga joylash» (owner's decision, November 2026): the product goes to the shop's channel
 * with the owner's words and «Buyurtma berish». The photo is drawn again as a JPEG here; a
 * product without one is posted as text. Without a channel the sheet connects it first.
 */
export function ChannelPostSheet({
    product,
    onClose,
}: {
    product: ProductDTO
    onClose(): void
}): React.JSX.Element {
    const t = useT()
    const c = t.owner.channel
    const state = useShopChannel()
    const { info, load } = state
    const [text, setText] = useState(product.description ?? "")
    const [posting, setPosting] = useState(false)
    useEffect(() => {
        load().catch((caught: unknown) => channelFailToast(t, caught))
    }, [load, t])

    const publish = async (): Promise<void> => {
        setPosting(true)
        try {
            const url = imageUrl(product.imageKey)
            let photo: Blob | null = null
            if (url) {
                photo = await drawPostPhoto(url).catch(() => null)
                if (!photo) {
                    haptic.error()
                    toast(c.post.photoFailed, "error")
                    return
                }
            }
            await channelApi.post(product.id, text.trim(), photo)
            haptic.success()
            toast(c.post.published, "success")
            onClose()
        } catch (caught) {
            // The bot lost its rights: Zumda disconnected the channel, the sheet offers it again.
            if (caught instanceof ApiError && caught.code === "CHANNEL_NO_RIGHTS") {
                state.set(null)
            }
            channelFailToast(t, caught)
        } finally {
            setPosting(false)
        }
    }

    return (
        <Sheet
            title={c.post.button}
            onClose={onClose}
            footer={
                info ? (
                    <Button size="lg" loading={posting} onClick={(): void => void publish()}>
                        {c.post.publish}
                    </Button>
                ) : null
            }
        >
            {info === undefined ? (
                <Skeleton className="h-48 rounded-tile" />
            ) : info === null ? (
                <div className="flex flex-col gap-3">
                    <p className="text-tg-subtitle">{c.post.noChannel}</p>
                    <ConnectChannel state={state} />
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    <Field
                        label={c.post.text}
                        htmlFor="post-text"
                        hint={`${c.post.textHint} ${text.length} / ${POST_TEXT_MAX}`}
                    >
                        <TextArea
                            id="post-text"
                            rows={4}
                            maxLength={POST_TEXT_MAX}
                            value={text}
                            onChange={(event): void => setText(event.target.value)}
                        />
                    </Field>
                    <PostPreview channel={info} product={product} text={text} />
                </div>
            )}
        </Sheet>
    )
}
