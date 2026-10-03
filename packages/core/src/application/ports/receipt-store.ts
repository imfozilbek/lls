/** A transfer screenshot as it arrived from the customer's phone. */
export interface ReceiptUpload {
    businessId: string
    orderId: string
    bytes: Uint8Array
    contentType: string
}

/**
 * Private storage of transfer screenshots: only the order's customer and the shop's owner ever
 * see one. The hash lets the same picture be recognised when it comes again.
 */
export interface ReceiptStore {
    put(upload: ReceiptUpload): Promise<{ key: string; hash: string }>
    remove(key: string): Promise<void>
}
