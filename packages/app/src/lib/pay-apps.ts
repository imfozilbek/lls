/** A bank app the customer transfers to the shop's card from. */
export interface PayApp {
    id: string
    /** The app's own name: never translated. */
    name: string
    /** An address the app claims for itself: the phone opens the app when it is installed. */
    url: string
    /** Its official icon (App Store), in `public/pay-apps/`. */
    icon: string
}

const icon = (id: string): string => `${import.meta.env.BASE_URL}pay-apps/${id}.webp`

/**
 * After «Raqamni nusxalash» (owner's decision, November 2026), the bank apps people transfer
 * from: Payme first (a shop owner's ask, November 2026), then the widest. Each address is one
 * the app declares in its own `apple-app-site-association` and `assetlinks.json`; none takes a
 * card and a sum prefilled, so the number is copied first and the sum is shown. Click opens
 * right on its transfers.
 */
export const PAY_APPS: readonly PayApp[] = [
    { id: "payme", name: "Payme", url: "https://payme.uz/openapp", icon: icon("payme") },
    { id: "click", name: "Click", url: "https://my.click.uz/app/transfers", icon: icon("click") },
    { id: "uzum", name: "Uzum Bank", url: "https://uzumbank.uz/goto", icon: icon("uzum") },
    { id: "paynet", name: "Paynet", url: "https://app.paynet.uz/", icon: icon("paynet") },
]
