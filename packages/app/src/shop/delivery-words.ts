import { Language, SendWay } from "@zumda/core"

/**
 * The customer's words about how the order travels (owner's decision, November 2026): the shop's
 * dispatcher, the way they sent it, a delivery the customer pays to the carrier. Only the lazy
 * checkout and order screens use them, so they stay out of the first download (the dictionary
 * mechanism as everywhere: one block per language).
 */
const WORDS = {
    [Language.UZ]: {
        /** The totals' delivery line when the price comes after the order (paid to the carrier). */
        apart: "jo'natilganda ma'lum qilinadi",
        apartHint: "Masofaga qarab, jo'natilganda aytiladi. Uni yetkazuvchiga o'zingiz to'laysiz.",
        dispatcher: "Dispetcher: {name}",
        callDispatcher: "Dispetcherga qo'ng'iroq",
        sentVia: {
            [SendWay.SELF]: "Dispetcher o'zi olib bormoqda",
            [SendWay.TAXI]: "Taksi bilan jo'natildi",
            [SendWay.POST]: "Pochta orqali jo'natildi",
            [SendWay.OTHER]: "Jo'natildi",
        } satisfies Record<SendWay, string>,
    },
}

export type DeliveryWords = (typeof WORDS)[Language]

export function deliveryWords(language: Language): DeliveryWords {
    return WORDS[language]
}
