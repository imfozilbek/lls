import { randomToken } from "../crypto.js"

import type { ReceiptStore, ReceiptUpload } from "@zumda/core"

const EXTENSIONS: Record<string, string> = {
    "image/webp": "webp",
    "image/jpeg": "jpg",
    "image/png": "png",
}

/** Outside `shops/`: the public `/img` route never serves a receipt. */
export const RECEIPT_KEY_PREFIX = "receipts/"

function toHex(buffer: ArrayBuffer): string {
    return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

/** Transfer screenshots in R2, private: they show bank details of the customer. */
export class R2ReceiptStore implements ReceiptStore {
    constructor(private readonly bucket: R2Bucket) {}

    async put(upload: ReceiptUpload): Promise<{ key: string; hash: string }> {
        const ext = EXTENSIONS[upload.contentType] ?? "bin"
        const key = `${RECEIPT_KEY_PREFIX}${upload.businessId}/${upload.orderId}/${randomToken(9)}.${ext}`
        const hash = toHex(await crypto.subtle.digest("SHA-256", upload.bytes))
        await this.bucket.put(key, upload.bytes, {
            httpMetadata: { contentType: upload.contentType, cacheControl: "private, no-store" },
        })
        return { key, hash }
    }

    async remove(key: string): Promise<void> {
        if (key.startsWith(RECEIPT_KEY_PREFIX)) {
            await this.bucket.delete(key)
        }
    }
}
