import { POST_TEXT_MAX } from "@zumda/core"
import { useEffect, useState } from "react"

import { errorText, fill, useLanguage, useT } from "../i18n/index.js"
import { ApiError } from "../lib/api.js"
import { useClosingGuard } from "../lib/main-button.js"
import { haptic } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { Button, Field, Skeleton, TextArea } from "../ui/primitives.js"
import { Sheet } from "../ui/sheet.js"

import { ConnectChannel } from "./ChannelGroup.js"
import { channelApi } from "./channel-api.js"
import { channelFailToast, useShopChannel } from "./channel-state.js"
import { postPreview } from "./channel-words.js"
import { layoutOr } from "./post-collage.js"
import { CollagePreview, PostMediaPicker, productMedia } from "./post-media.js"
import { drawPostPicture, fetchPhoto } from "./post-photo.js"
import { MAX_VIDEO_BYTES } from "./video-upload.js"

import type { ChannelInfo, SourceLinkView } from "./channel-api.js"
import type { PostMediaState } from "./post-media.js"
import type { ProductDTO } from "@zumda/core"

/** The post as the channel will show it: the photo, the name, the words, the price, the button. */
function PostPreview({
    channel,
    product,
    text,
    media,
}: {
    channel: ChannelInfo
    product: ProductDTO
    text: string
    media: PostMediaState
}): React.JSX.Element {
    const t = useT()
    const language = useLanguage()
    const preview = postPreview(product, t, language)
    return (
        <figure className="flex flex-col gap-1.5" aria-label={t.owner.channel.post.preview}>
            <figcaption className="px-1 text-sm font-medium text-tg-subtitle">
                {t.owner.channel.post.preview}
            </figcaption>
            <div className="overflow-hidden rounded-tile bg-tg-secondary">
                <p className="truncate px-3 pt-2.5 text-sm font-semibold text-brand">
                    {channel.title}
                </p>
                {media.video ? (
                    <video
                        src={media.video.url}
                        muted
                        playsInline
                        controls
                        preload="metadata"
                        className="mt-2 max-h-64 w-full bg-black"
                    />
                ) : (
                    <CollagePreview media={media} />
                )}
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
 * Sends the post: a video with its progress, else the picture drawn here (one photo or a
 * collage), else the words alone. The bot lost its rights: the sheet offers the channel again.
 */
function usePostPublisher(input: {
    product: ProductDTO
    media: PostMediaState
    text: string
    state: ReturnType<typeof useShopChannel>
    onDone(): void
}): { posting: boolean; progress: number | null; publish(): Promise<void> } {
    const { product, media, text, state, onDone } = input
    const t = useT()
    const c = t.owner.channel
    const [posting, setPosting] = useState(false)
    /** The video's upload, 0..1, while it goes. */
    const [progress, setProgress] = useState<number | null>(null)
    // Closing the app now would cut the video off halfway.
    useClosingGuard(progress !== null)
    /** The picture of the post: one photo, or a collage of two to four; none: a text post. */
    const picture = async (): Promise<Blob | null> => {
        const layout = layoutOr(media.layout, media.photos.length)
        if (!layout) {
            return null
        }
        const photos = await Promise.all(
            media.photos.map((photo) => photo.file ?? fetchPhoto(photo.url)),
        )
        return drawPostPicture(photos, layout)
    }

    const send = async (): Promise<SourceLinkView | null> => {
        const words = text.trim()
        const video = media.video
        if (video) {
            if (video.file.size > MAX_VIDEO_BYTES) {
                haptic.error()
                toast(errorText(t, "VIDEO_TOO_LARGE"), "error")
                return null
            }
            setProgress(0)
            return channelApi.postVideo(product.id, words, video, setProgress)
        }
        const photo = await picture().catch(() => undefined)
        if (photo === undefined) {
            haptic.error()
            toast(c.post.photoFailed, "error")
            return null
        }
        return channelApi.post(product.id, words, photo)
    }

    const publish = async (): Promise<void> => {
        setPosting(true)
        try {
            if (!(await send())) {
                return
            }
            haptic.success()
            toast(c.post.published, "success")
            onDone()
        } catch (caught) {
            // The bot lost its rights: Zumda disconnected the channel, the sheet offers it again.
            if (caught instanceof ApiError && caught.code === "CHANNEL_NO_RIGHTS") {
                state.set(null)
            }
            channelFailToast(t, caught)
        } finally {
            setPosting(false)
            setProgress(null)
        }
    }

    return { posting, progress, publish }
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
    const [media, setMedia] = useState<PostMediaState>(() => productMedia(product))
    useEffect(() => {
        load().catch((caught: unknown) => channelFailToast(t, caught))
    }, [load, t])
    const { posting, progress, publish } = usePostPublisher({
        product,
        media,
        text,
        state,
        onDone: onClose,
    })

    return (
        <Sheet
            title={c.post.button}
            onClose={onClose}
            footer={
                info ? (
                    <div className="flex flex-col gap-2">
                        {progress === null ? null : (
                            <p className="text-center text-sm text-tg-subtitle" role="status">
                                {fill(c.post.uploading, { p: String(Math.round(progress * 100)) })}
                                <span className="block text-tg-hint">{c.post.keepOpen}</span>
                            </p>
                        )}
                        <Button size="lg" loading={posting} onClick={(): void => void publish()}>
                            {c.post.publish}
                        </Button>
                    </div>
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
                    <PostMediaPicker
                        media={media}
                        onChange={setMedia}
                        onVideoRefused={(): void => {
                            haptic.error()
                            toast(errorText(t, "UNSUPPORTED_VIDEO"), "error")
                        }}
                    />
                    <Field
                        label={c.post.text}
                        htmlFor="post-text"
                        hint={
                            <span className="flex items-start justify-between gap-3">
                                <span>{c.post.textHint}</span>
                                <span className="shrink-0 tabular-nums">
                                    {text.length} / {POST_TEXT_MAX}
                                </span>
                            </span>
                        }
                    >
                        <TextArea
                            id="post-text"
                            rows={4}
                            maxLength={POST_TEXT_MAX}
                            value={text}
                            onChange={(event): void => setText(event.target.value)}
                        />
                    </Field>
                    <PostPreview channel={info} product={product} text={text} media={media} />
                </div>
            )}
        </Sheet>
    )
}
