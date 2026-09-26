import { Language, OrderStatus } from "@lls/core"

/** Bot message texts. Keep Uzbek (Latin) and Russian in sync. */
export const TEXTS = {
    [Language.UZ]: {
        currency: "so'm",
        newOrder: "🆕 Yangi buyurtma",
        order: "Buyurtma",
        delivery: "Yetkazib berish",
        free: "bepul",
        total: "Jami",
        landmark: "mo'ljal",
        map: "Xaritada ochish",
        status: "Holat",
        cancelledByCustomer: "❌ Mijoz buyurtmani bekor qildi",
        cancel: "❌ Bekor qilish",
        reason: "Sabab",
        statusNames: {
            [OrderStatus.PENDING]: "🆕 Yangi",
            [OrderStatus.ACCEPTED]: "✅ Qabul qilindi",
            [OrderStatus.PREPARING]: "👨‍🍳 Tayyorlanmoqda",
            [OrderStatus.READY]: "📦 Tayyor",
            [OrderStatus.PICKED_UP]: "🚚 Yo'lda",
            [OrderStatus.DELIVERED]: "🏁 Yetkazildi",
            [OrderStatus.CANCELLED]: "❌ Bekor qilindi",
        },
        actions: {
            [OrderStatus.ACCEPTED]: "✅ Qabul qilish",
            [OrderStatus.PREPARING]: "👨‍🍳 Tayyorlashni boshlash",
            [OrderStatus.READY]: "📦 Tayyor",
            [OrderStatus.PICKED_UP]: "🚚 Yo'lga chiqdi",
            [OrderStatus.DELIVERED]: "🏁 Yetkazildi",
        } as Partial<Record<OrderStatus, string>>,
        customerStatus: {
            [OrderStatus.ACCEPTED]: "✅ #{n} buyurtmangiz qabul qilindi.",
            [OrderStatus.PREPARING]: "👨‍🍳 #{n} buyurtmangiz tayyorlanmoqda.",
            [OrderStatus.READY]: "📦 #{n} buyurtmangiz tayyor.",
            [OrderStatus.PICKED_UP]: "🚚 #{n} buyurtmangiz yo'lda. Tez orada yetib boradi!",
            [OrderStatus.DELIVERED]: "🏁 #{n} buyurtmangiz yetkazildi. Yoqimli ishtaha!",
            [OrderStatus.CANCELLED]: "❌ #{n} buyurtmangiz bekor qilindi.",
        } as Partial<Record<OrderStatus, string>>,
        shopWelcome:
            "Assalomu alaykum! {shop} menyusini oching va bir necha bosishda buyurtma bering.",
        openMenu: "🍽 Menyuni ochish",
        phoneSaved: "✅ Telefon raqamingiz saqlandi.",
        platformWelcome:
            "LLS — do'koningiz uchun Telegram'da o'z buyurtma boti. Ulash uchun tugmani bosing.",
        connectShop: "🏪 Do'konni ulash",
        applicationReceived: "✅ {shop} arizasi qabul qilindi. Tekshiruvdan so'ng xabar beramiz.",
        shopApproved: "🎉 {shop} ishga tushdi! Mijozlaringizga ushbu havolani yuboring:",
        shopRejected: "😔 {shop} arizasi rad etildi. Savollar bo'lsa, bizga yozing.",
        callbackDone: "Tayyor",
        callbackOutdated: "Holat allaqachon o'zgargan",
        callbackForbidden: "Bu amal faqat do'kon egasi uchun",
    },
    [Language.RU]: {
        currency: "сум",
        newOrder: "🆕 Новый заказ",
        order: "Заказ",
        delivery: "Доставка",
        free: "бесплатно",
        total: "Итого",
        landmark: "ориентир",
        map: "Открыть на карте",
        status: "Статус",
        cancelledByCustomer: "❌ Клиент отменил заказ",
        cancel: "❌ Отменить",
        reason: "Причина",
        statusNames: {
            [OrderStatus.PENDING]: "🆕 Новый",
            [OrderStatus.ACCEPTED]: "✅ Принят",
            [OrderStatus.PREPARING]: "👨‍🍳 Готовится",
            [OrderStatus.READY]: "📦 Готов",
            [OrderStatus.PICKED_UP]: "🚚 В пути",
            [OrderStatus.DELIVERED]: "🏁 Доставлен",
            [OrderStatus.CANCELLED]: "❌ Отменён",
        },
        actions: {
            [OrderStatus.ACCEPTED]: "✅ Принять",
            [OrderStatus.PREPARING]: "👨‍🍳 Начать готовить",
            [OrderStatus.READY]: "📦 Готов",
            [OrderStatus.PICKED_UP]: "🚚 Отправлен",
            [OrderStatus.DELIVERED]: "🏁 Доставлен",
        } as Partial<Record<OrderStatus, string>>,
        customerStatus: {
            [OrderStatus.ACCEPTED]: "✅ Заказ #{n} принят.",
            [OrderStatus.PREPARING]: "👨‍🍳 Заказ #{n} готовится.",
            [OrderStatus.READY]: "📦 Заказ #{n} готов.",
            [OrderStatus.PICKED_UP]: "🚚 Заказ #{n} в пути. Скоро будет у вас!",
            [OrderStatus.DELIVERED]: "🏁 Заказ #{n} доставлен. Приятного аппетита!",
            [OrderStatus.CANCELLED]: "❌ Заказ #{n} отменён.",
        } as Partial<Record<OrderStatus, string>>,
        shopWelcome: "Здравствуйте! Откройте меню {shop} и закажите в пару нажатий.",
        openMenu: "🍽 Открыть меню",
        phoneSaved: "✅ Ваш номер сохранён.",
        platformWelcome:
            "LLS — собственный бот для заказов вашего магазина в Telegram. Нажмите кнопку, чтобы подключиться.",
        connectShop: "🏪 Подключить магазин",
        applicationReceived: "✅ Заявка {shop} принята. Сообщим после проверки.",
        shopApproved: "🎉 {shop} запущен! Отправьте клиентам эту ссылку:",
        shopRejected: "😔 Заявка {shop} отклонена. Если есть вопросы, напишите нам.",
        callbackDone: "Готово",
        callbackOutdated: "Статус уже изменился",
        callbackForbidden: "Это действие только для владельца магазина",
    },
} as const

export type BotTexts = (typeof TEXTS)[Language]

export function textsFor(language: Language): BotTexts {
    return TEXTS[language]
}

/** "{shop}" / "#{n}" placeholders. */
export function fill(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) =>
        key in values ? String(values[key]) : match,
    )
}
