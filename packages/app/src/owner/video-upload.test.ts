import { describe, expect, it } from "vitest"

import { videoTypeOf } from "./video-upload.js"

const file = (name: string, type: string): File => new File([new Uint8Array(4)], name, { type })

describe("a video for the channel", () => {
    it("takes a phone's mp4 and an iPhone's mov, by type or by name", () => {
        expect(videoTypeOf(file("a.mp4", "video/mp4"))).toBe("video/mp4")
        expect(videoTypeOf(file("IMG_1.MOV", "video/quicktime"))).toBe("video/quicktime")
        // Some phones leave the type empty: the name tells it.
        expect(videoTypeOf(file("IMG_2.MOV", ""))).toBe("video/quicktime")
        expect(videoTypeOf(file("clip.mp4", ""))).toBe("video/mp4")
    })

    it("refuses what Telegram does not show as a video", () => {
        expect(videoTypeOf(file("a.webm", "video/webm"))).toBeNull()
        expect(videoTypeOf(file("a.avi", ""))).toBeNull()
    })
})
