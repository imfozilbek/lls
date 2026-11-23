import { useEffect, useRef } from "react"

import { useT } from "../i18n/index.js"
import { imageUrl } from "../lib/api.js"
import { haptic } from "../lib/telegram.js"
import { CloseIcon, ImageIcon, PlusIcon } from "../ui/icons.js"
import { Button, Segmented } from "../ui/primitives.js"

import { CollageLayout, MAX_POST_PHOTOS, cellsOf, layoutOr, layoutsFor } from "./post-collage.js"
import { videoTypeOf } from "./video-upload.js"

import type { ProductDTO } from "@zumda/core"

/** A photo of the post: the catalog's (its address) or one from the phone (its file). */
export interface PostPhoto {
    key: string
    url: string
    file?: File
}

export interface PostVideo {
    file: File
    type: string
    url: string
}

/** What goes above the post's words: photos (a collage from two), a video, or nothing. */
export interface PostMediaState {
    photos: PostPhoto[]
    video: PostVideo | null
    layout: CollageLayout | null
}

/** The product's own photos, chosen at first (the main one first). */
export function productMedia(product: ProductDTO): PostMediaState {
    const keys = [product.imageKey, ...(product.moreImageKeys ?? [])].filter((key): key is string =>
        Boolean(key),
    )
    const photos = keys.flatMap((key) => {
        const url = imageUrl(key)
        return url ? [{ key, url }] : []
    })
    return { photos, video: null, layout: layoutOr(null, photos.length) }
}

/** The collage as the channel will show it: the same cells as the drawn picture. */
export function CollagePreview({ media }: { media: PostMediaState }): React.JSX.Element | null {
    const layout = layoutOr(media.layout, media.photos.length)
    if (!layout) {
        return null
    }
    if (layout === CollageLayout.SINGLE) {
        const photo = media.photos[0]
        return photo ? (
            <img src={photo.url} alt="" className="mt-2 max-h-64 w-full bg-tg-bg object-cover" />
        ) : null
    }
    const square = layout === CollageLayout.GRID
    const tall = layout === CollageLayout.STACK
    return (
        <div
            className="relative mt-2 w-full bg-white"
            style={{ aspectRatio: square ? "1 / 1" : tall ? "5 / 8" : "8 / 5" }}
        >
            {cellsOf(layout).map((cell, index) => {
                const photo = media.photos[index]
                return photo ? (
                    <img
                        key={photo.key}
                        src={photo.url}
                        alt=""
                        className="absolute object-cover p-0.5"
                        style={{
                            left: `${cell.x * 100}%`,
                            top: `${cell.y * 100}%`,
                            width: `${cell.w * 100}%`,
                            height: `${cell.h * 100}%`,
                        }}
                    />
                ) : null
            })}
        </div>
    )
}

function Tile({
    label,
    onRemove,
    children,
}: {
    label: string
    onRemove(): void
    children: React.ReactNode
}): React.JSX.Element {
    return (
        <li className="relative aspect-square animate-fade-in overflow-hidden rounded-control bg-tg-secondary">
            {children}
            <button
                type="button"
                aria-label={label}
                onClick={(): void => {
                    haptic.tap()
                    onRemove()
                }}
                className="tap absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white"
            >
                <CloseIcon size={14} />
            </button>
        </li>
    )
}

/** A button that opens the phone's gallery (never a label tied to the input: Android 17). */
function PickButton({
    label,
    accept,
    multiple,
    onPick,
}: {
    label: string
    accept: string
    multiple?: boolean
    onPick(files: File[]): void
}): React.JSX.Element {
    const input = useRef<HTMLInputElement>(null)
    return (
        <>
            <Button
                variant="secondary"
                icon={<PlusIcon size={18} />}
                onClick={(): void => input.current?.click()}
            >
                {label}
            </Button>
            <input
                ref={input}
                type="file"
                accept={accept}
                multiple={multiple}
                className="hidden"
                onChange={(event): void => {
                    onPick([...(event.target.files ?? [])])
                    event.target.value = ""
                }}
            />
        </>
    )
}

/** Gives back the addresses of the phone's files the sheet no longer shows. */
function useFreedUrls(media: PostMediaState): void {
    const shown = useRef(new Set<string>())
    useEffect(() => {
        const now = new Set(
            [...media.photos.filter((p) => p.file).map((p) => p.url), media.video?.url].filter(
                (url): url is string => Boolean(url),
            ),
        )
        for (const url of shown.current) {
            if (!now.has(url)) {
                URL.revokeObjectURL(url)
            }
        }
        shown.current = now
    }, [media])
    useEffect(
        () => (): void => {
            for (const url of shown.current) {
                URL.revokeObjectURL(url)
            }
        },
        [],
    )
}

/** The video, or the photos in the order the collage takes them, each with its «×». */
function MediaTiles({
    media,
    onChange,
}: {
    media: PostMediaState
    onChange(media: PostMediaState): void
}): React.JSX.Element {
    const p = useT().owner.channel.post
    const removePhoto = (key: string): void => {
        const photos = media.photos.filter((photo) => photo.key !== key)
        onChange({ ...media, photos, layout: layoutOr(media.layout, photos.length) })
    }
    return (
        <>
            {media.video ? (
                <ul className="grid grid-cols-2 gap-2">
                    <Tile
                        label={p.remove}
                        onRemove={(): void => onChange({ ...media, video: null })}
                    >
                        <video
                            src={media.video.url}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-cover"
                        />
                    </Tile>
                </ul>
            ) : media.photos.length > 0 ? (
                <ul className="grid grid-cols-4 gap-2">
                    {media.photos.map((photo) => (
                        <Tile
                            key={photo.key}
                            label={p.remove}
                            onRemove={(): void => removePhoto(photo.key)}
                        >
                            <img src={photo.url} alt="" className="h-full w-full object-cover" />
                        </Tile>
                    ))}
                </ul>
            ) : (
                <span className="grid h-16 place-items-center rounded-control bg-tg-secondary text-tg-hint">
                    <ImageIcon size={22} />
                </span>
            )}
        </>
    )
}

/**
 * «Rasmlar va video» (owner's decision, November 2026): the product's photos at first, more from
 * the phone up to four (a collage, the layout picked by chips), or one video instead.
 */
export function PostMediaPicker({
    media,
    onChange,
    onVideoRefused,
}: {
    media: PostMediaState
    onChange(media: PostMediaState): void
    onVideoRefused(): void
}): React.JSX.Element {
    const p = useT().owner.channel.post
    useFreedUrls(media)
    const layouts = layoutsFor(media.photos.length)
    const layout = layoutOr(media.layout, media.photos.length)
    const addPhotos = (files: File[]): void => {
        const room = MAX_POST_PHOTOS - media.photos.length
        const added = files.slice(0, room).map((file, index) => ({
            key: `file-${Date.now()}-${index}`,
            url: URL.createObjectURL(file),
            file,
        }))
        const photos = [...media.photos, ...added]
        onChange({ ...media, photos, layout: layoutOr(media.layout, photos.length) })
    }
    const pickVideo = ([file]: File[]): void => {
        const type = file ? videoTypeOf(file) : null
        if (!file || !type) {
            onVideoRefused()
            return
        }
        onChange({ ...media, video: { file, type, url: URL.createObjectURL(file) } })
    }
    return (
        <section className="flex flex-col gap-3" aria-label={p.media}>
            <h3 className="px-1 text-sm font-medium text-tg-subtitle">{p.media}</h3>
            <MediaTiles media={media} onChange={onChange} />
            {!media.video && layouts.length > 1 && layout ? (
                <Segmented<CollageLayout>
                    value={layout}
                    options={layouts.map((value) => ({
                        value,
                        label: p.layouts[value as keyof typeof p.layouts],
                    }))}
                    onChange={(value): void => onChange({ ...media, layout: value })}
                />
            ) : null}
            <p className="px-1 text-sm text-tg-hint">
                {media.video
                    ? p.videoHint
                    : media.photos.length >= MAX_POST_PHOTOS
                      ? p.maxPhotos
                      : media.photos.length > 1
                        ? p.collageHint
                        : null}
            </p>
            {media.video ? null : (
                <div className="flex flex-wrap gap-2">
                    {media.photos.length < MAX_POST_PHOTOS ? (
                        <PickButton
                            label={p.addPhoto}
                            accept="image/*"
                            multiple
                            onPick={addPhotos}
                        />
                    ) : null}
                    <PickButton
                        label={p.pickVideo}
                        accept="video/mp4,video/quicktime,.mp4,.mov"
                        onPick={pickVideo}
                    />
                </div>
            )}
        </section>
    )
}
