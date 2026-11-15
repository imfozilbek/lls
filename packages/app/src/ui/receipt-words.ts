import { Language } from "@zumda/core"

/**
 * The words of the transfer screenshot (the customer's sheet, the receipt viewer of the customer
 * and the owner). Only lazy screens use them, so they stay out of the first download (one block
 * per language, as every dictionary).
 */
const WORDS = {
    [Language.UZ]: {
        title: "O'tkazma cheki",
        hint: "Bank ilovasidagi o'tkazma chekining skrinshotini yuklang: summa va karta ko'rinsin. Keyin «O'tkazdim» ni bosing.",
        howTo: "Chek ochiq turganda skrinshot oling: Android'da quvvat va ovozni pasaytirish, iPhone'da yon tugma va ovozni oshirish tugmalarini birga bosing.",
        pick: "Skrinshotni tanlash",
        change: "Boshqa rasm",
        /** Opens once the screenshot is picked (owner's decision, November 2026). */
        confirm: "O'tkazdim",
        sent: "Chek yuborildi. Do'kon pulni tekshiradi.",
        unreadable: "Bu rasmni ochib bo'lmadi. Boshqa skrinshot tanlang.",
        open: "Chekni ko'rish",
        zoom: "Kattalashtirish",
        close: "Yopish",
        loadFailed: "Chekni yuklab bo'lmadi",
        expired: "Chek o'chirilgan (30 kun saqlanadi)",
        none: "Chek yo'q",
    },
}

export type ReceiptWords = (typeof WORDS)[Language]

export function receiptWords(language: Language): ReceiptWords {
    return WORDS[language]
}
