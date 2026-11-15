import { beforeEach, describe, expect, it, vi } from "vitest"

import { makeMain, photoKeys, savePhotos, sentPhoto, slotsOf } from "./photos.js"

import type { ProductDTO } from "@zumda/core"

/** The server as the photo routes answer: the product with its photos, the first is main. */
let server: string[] = []
let next = 0
const product = (): ProductDTO =>
    ({
        id: "p1",
        ...(server[0] ? { imageKey: server[0] } : {}),
        ...(server.length > 1 ? { moreImageKeys: server.slice(1) } : {}),
    }) as ProductDTO

const calls: string[] = []
vi.mock("../lib/api.js", () => ({
    api: {
        owner: {
            addProductPhoto: async (): Promise<ProductDTO> => {
                const key = `new-${(next += 1)}.webp`
                calls.push(`add ${key}`)
                server = [...server, key]
                return product()
            },
            removeProductPhoto: async (_id: string, key: string): Promise<ProductDTO> => {
                calls.push(`remove ${key}`)
                server = server.filter((k) => k !== key)
                return product()
            },
            orderProductPhotos: async (_id: string, keys: string[]): Promise<ProductDTO> => {
                calls.push(`order ${keys.join(",")}`)
                server = [...keys]
                return product()
            },
        },
    },
}))

const blob = (id: string): { blob: Blob; id: string } => ({ blob: new Blob(["x"]), id })

describe("the form's photos onto the product", () => {
    beforeEach(() => {
        server = []
        next = 0
        calls.length = 0
    })

    it("the product's photos are the form's, the main one first", () => {
        server = ["a.webp", "b.webp"]
        expect(photoKeys(product())).toEqual(["a.webp", "b.webp"])
        expect(slotsOf(product())).toEqual([{ key: "a.webp" }, { key: "b.webp" }])
        expect(photoKeys(undefined)).toEqual([])
        const slots = [{ key: "a.webp" }, blob("x"), { key: "b.webp" }]
        expect(makeMain(slots, 2)).toEqual([{ key: "b.webp" }, { key: "a.webp" }, slots[1]])
        expect(sentPhoto(slots, "x", "n.webp")[1]).toEqual({ key: "n.webp" })
    })

    it("taken away first, new ones in their order, then the order when it differs", async () => {
        server = ["a.webp", "b.webp"]
        const sent: string[] = []
        const saved = await savePhotos(
            product(),
            [blob("x"), { key: "b.webp" }],
            (id, key) => void sent.push(`${id}=${key}`),
        )
        expect(calls).toEqual(["remove a.webp", "add new-1.webp", "order new-1.webp,b.webp"])
        expect(sent).toEqual(["x=new-1.webp"])
        expect(photoKeys(saved)).toEqual(["new-1.webp", "b.webp"])
    })

    it("nothing changed: nothing is sent", async () => {
        server = ["a.webp"]
        await savePhotos(product(), [{ key: "a.webp" }], () => undefined)
        expect(calls).toEqual([])
    })
})
