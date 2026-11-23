import { query, request } from "../lib/api.js"

import { uploadVideo } from "./video-upload.js"

import type {
    HistoryOutcome,
    Page,
    ShopChannelDTO,
    SourceLinkDTO,
    SourceLinkKind,
} from "@zumda/core"

/** The connected channel and Telegram's count of its subscribers (none when it cannot say). */
export type ChannelInfo = ShopChannelDTO & { subscribers: number | null }

/** A post or an ad link with the address to give out: `t.me/<shop bot>?start=s_<code>`. */
export type SourceLinkView = SourceLinkDTO & { url: string }

/**
 * The shop's own Telegram channel and its links. Its own module in the owner's chunk: these calls
 * never reach a customer's first JS.
 */
export const channelApi = {
    channel: (): Promise<{ channel: ChannelInfo | null }> => request("GET", "/api/owner/channel"),
    /** The shop's bot hears the channel from now on; `url` opens Telegram's own screen. */
    connect: (): Promise<{ url: string }> => request("POST", "/api/owner/channel/connect"),
    disconnect: (): Promise<void> => request("DELETE", "/api/owner/channel"),
    /** «Joylash»: the product, the owner's words and the JPEG drawn for it (none: a text post). */
    post: (productId: string, text: string, photo: Blob | null): Promise<SourceLinkView> =>
        request(
            "POST",
            `/api/owner/channel/posts${query({ productId, text: text || undefined })}`,
            photo ?? undefined,
        ),
    /** A video post: the bytes go on to Telegram as they come, with the upload's progress. */
    postVideo: (
        productId: string,
        text: string,
        video: { file: File; type: string },
        onProgress: (fraction: number) => void,
    ): Promise<SourceLinkView> =>
        uploadVideo(
            `/api/owner/channel/posts${query({ productId, text: text || undefined })}`,
            video.file,
            video.type,
            onProgress,
        ),
    links: (kind: SourceLinkKind, page = 1): Promise<Page<SourceLinkView>> =>
        request("GET", `/api/owner/links${query({ kind, page })}`),
    createLink: (label: string, productId?: string): Promise<SourceLinkView> =>
        request("POST", "/api/owner/links", { label, ...(productId ? { productId } : {}) }),
    /** An ad link stops counting; a post is deleted in the channel too. */
    removeLink: (id: string): Promise<void> => request("DELETE", `/api/owner/links/${id}`),
    /** «Mahsulotni tanlash»: the owner's own post leads to this product, or the whole shop. */
    relink: (id: string, productId: string | null): Promise<SourceLinkView> =>
        request("PATCH", `/api/owner/links/${id}`, { productId }),
    /** «Eski postlarni ham qo'shish»: one page of the channel's past, up to ten posts. */
    history: (): Promise<HistoryOutcome> => request("POST", "/api/owner/channel/history"),
}
