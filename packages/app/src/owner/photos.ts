import { api } from "../lib/api.js"

import type { ProductDTO } from "@zumda/core"

/** Up to three photos a product (owner's decision, November 2026); the first is the main one. */
export const MAX_PHOTOS = 3

/** A photo in the form: one the product has (its key), or one picked here and not sent yet. */
export type PhotoSlot = { key: string } | { blob: Blob; id: string }

/** The product's photos, the main one first. */
export function photoKeys(product: ProductDTO | undefined): string[] {
    if (!product?.imageKey) {
        return []
    }
    return [product.imageKey, ...(product.moreImageKeys ?? [])]
}

export function slotsOf(product: ProductDTO | undefined): PhotoSlot[] {
    return photoKeys(product).map((key) => ({ key }))
}

/** The same photos, kept or new, in the same order: nothing to send. */
export function samePhotos(slots: readonly PhotoSlot[], product: ProductDTO | undefined): boolean {
    const keys = slots.map((slot) => ("key" in slot ? slot.key : null))
    return keys.join("|") === photoKeys(product).join("|")
}

/** A picked photo the server took: its key from now on. */
export function sentPhoto(slots: readonly PhotoSlot[], id: string, key: string): PhotoSlot[] {
    return slots.map((slot) => ("id" in slot && slot.id === id ? { key } : slot))
}

/** The photo moved to the front: the main one. */
export function makeMain(slots: readonly PhotoSlot[], index: number): PhotoSlot[] {
    const slot = slots[index]
    return slot ? [slot, ...slots.filter((_, i) => i !== index)] : [...slots]
}

/**
 * The form's photos onto the saved product, step by step: the ones taken away, the new ones in
 * their order (each reported by `onUploaded`, so a retry after a failure never sends it twice),
 * then the order when it differs. Returns the product as the server has it.
 */
export async function savePhotos(
    product: ProductDTO,
    slots: readonly PhotoSlot[],
    onUploaded: (id: string, key: string) => void,
): Promise<ProductDTO> {
    let saved = product
    const kept = new Set(slots.flatMap((slot) => ("key" in slot ? [slot.key] : [])))
    for (const key of photoKeys(saved)) {
        if (!kept.has(key)) {
            saved = await api.owner.removeProductPhoto(saved.id, key)
        }
    }
    const order: string[] = []
    for (const slot of slots) {
        if ("key" in slot) {
            order.push(slot.key)
            continue
        }
        const before = new Set(photoKeys(saved))
        saved = await api.owner.addProductPhoto(saved.id, slot.blob)
        const key = photoKeys(saved).find((k) => !before.has(k))
        if (key) {
            onUploaded(slot.id, key)
            order.push(key)
        }
    }
    const now = photoKeys(saved)
    const known = order.filter((key) => now.includes(key))
    if (known.length === now.length && known.join("|") !== now.join("|")) {
        saved = await api.owner.orderProductPhotos(saved.id, known)
    }
    return saved
}
