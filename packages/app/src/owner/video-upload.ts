import { API_URL, ApiError, authHeaders, refusalOf } from "../lib/api.js"

/** Telegram takes a bot's upload up to this size (the Worker refuses more: `VIDEO_TOO_LARGE`). */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
/** The videos Telegram shows as videos: a phone's mp4 and an iPhone's mov. */
export const VIDEO_TYPES = ["video/mp4", "video/quicktime"] as const
/**
 * A video of up to 50 MB on a slow regional line: minutes, not seconds. Its own deadline, apart
 * from a photo's two minutes (`UPLOAD_DEADLINE_MS`); nothing waits forever.
 */
export const VIDEO_DEADLINE_MS = 10 * 60_000

/** The video's type the Worker takes, or null (a phone may leave the type empty for a .mov). */
export function videoTypeOf(file: File): string | null {
    const type = file.type.toLowerCase()
    if ((VIDEO_TYPES as readonly string[]).includes(type)) {
        return type
    }
    const name = file.name.toLowerCase()
    if (name.endsWith(".mp4")) {
        return "video/mp4"
    }
    return name.endsWith(".mov") ? "video/quicktime" : null
}

/**
 * Sends a video to the Worker with its progress (fetch tells none). The answer is read like any
 * other call: a refusal's rule, or `NETWORK` when the line broke or the deadline passed.
 */
export function uploadVideo<T>(
    path: string,
    file: File,
    type: string,
    onProgress: (fraction: number) => void,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("POST", `${API_URL}${path}`)
        xhr.timeout = VIDEO_DEADLINE_MS
        authHeaders().forEach((value, key) => xhr.setRequestHeader(key, value))
        xhr.setRequestHeader("Content-Type", type)
        xhr.upload.onprogress = (event): void => {
            if (event.lengthComputable && event.total > 0) {
                onProgress(event.loaded / event.total)
            }
        }
        xhr.onload = (): void => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText) as T)
                return
            }
            reject(refusalOf(xhr.status, xhr.statusText, xhr.responseText))
        }
        const broken = (): void => reject(new ApiError(0, "NETWORK", "No connection"))
        xhr.onerror = broken
        xhr.ontimeout = broken
        xhr.onabort = broken
        xhr.send(file)
    })
}
