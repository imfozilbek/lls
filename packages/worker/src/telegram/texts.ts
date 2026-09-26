import { BusinessType, Language, OrderStatus } from "@lls/core"

type StatusTexts = Partial<Record<OrderStatus, string>>

/** Bot message texts. Keep Uzbek (Latin) and Russian in sync. */
const BASE = {
    [Language.UZ]: {
        currency: "so'm",
        newOrder: "🆕 Yangi buyurtma",
        order: "Buyurtma",
        delivery: "Yetkazib berish",
        deposit: "Idish garovi",
        free: "bepul",
        total: "Jami",
        landmark: "mo'ljal",
        map: "Xaritada ochish",
        status: "Holat",
        courier: "Kuryer",
        bottlesBack: "Bo'sh idish qaytaradi: {n} ta",
        cancelledByCustomer: "❌ Mijoz buyurtmani bekor qildi",
        cancel: "❌ Bekor qilish",
        reason: "Sabab",
        kg: "kg",
        statusNames: {
            [OrderStatus.PENDING]: "🆕 Yangi",
            [OrderStatus.ACCEPTED]: "✅ Qabul qilindi",
            [OrderStatus.PREPARING]: "📦 Yig'ilmoqda",
            [OrderStatus.READY]: "📦 Tayyor",
            [OrderStatus.PICKED_UP]: "🚚 Yo'lda",
            [OrderStatus.DELIVERED]: "🏁 Yetkazildi",
            [OrderStatus.CANCELLED]: "❌ Bekor qilindi",
        } as Record<OrderStatus, string>,
        actions: {
            [OrderStatus.ACCEPTED]: "✅ Qabul qilish",
            [OrderStatus.PREPARING]: "📦 Yig'ishni boshlash",
            [OrderStatus.READY]: "📦 Tayyor",
            [OrderStatus.PICKED_UP]: "🚚 Jo'natish",
            [OrderStatus.DELIVERED]: "🏁 Yetkazildi",
        } as StatusTexts,
        customerStatus: {
            [OrderStatus.ACCEPTED]: "✅ #{n} buyurtmangiz qabul qilindi.",
            [OrderStatus.PREPARING]: "📦 #{n} buyurtmangiz yig'ilmoqda.",
            [OrderStatus.READY]: "📦 #{n} buyurtmangiz tayyor.",
            [OrderStatus.PICKED_UP]: "🚚 #{n} buyurtmangiz yo'lda. Tez orada yetib boradi!",
            [OrderStatus.DELIVERED]: "🏁 #{n} buyurtmangiz yetkazildi. Rahmat!",
            [OrderStatus.CANCELLED]: "❌ #{n} buyurtmangiz bekor qilindi.",
        } as StatusTexts,
        courierOnTheWay: "🚚 #{n} buyurtmangizni {courier} olib kelmoqda.",
        shopWelcome:
            "Assalomu alaykum! {shop} katalogini oching va bir necha bosishda buyurtma bering.",
        openMenu: "🛒 Katalogni ochish",
        phoneSaved: "✅ Telefon raqamingiz saqlandi.",
        platformWelcome:
            "LLS — tumaningiz do'konlari bir joyda. Mahsulotni qidiring va do'kondan buyurtma bering.\n\nDo'kon egasimisiz? O'z buyurtma botingizni ulang.",
        connectShop: "🏪 Do'konni ulash",
        openShowcase: "🔍 Do'konlar va mahsulotlar",
        showcaseOrder: "🛍 LLS vitrinasidan · komissiya {rate}%: {sum}",
        showcaseJoined:
            "🛍 {shop} LLS vitrinasiga qo'shildi. Mijozlar uni LLS botida topadi.\nKomissiya: vitrina orqali sotilgan tovarlarning {rate}%. O'z botingiz orqali sotuvdan komissiya olinmaydi.",
        showcaseLeft: "{shop} LLS vitrinasidan olindi.",
        showcaseUsage:
            "Buyruq: /market <slug> <foiz>, masalan /market osh-markaz 5\nO'chirish: /market <slug> off",
        showcaseSet: "✅ {shop}: vitrinada, komissiya {rate}%",
        showcaseOff: "✅ {shop}: vitrinadan olindi",
        applicationReceived: "✅ {shop} arizasi qabul qilindi. Tekshiruvdan so'ng xabar beramiz.",
        shopApproved: "🎉 {shop} ishga tushdi! Mijozlaringizga ushbu havolani yuboring:",
        shopRejected: "😔 {shop} arizasi rad etildi. Savollar bo'lsa, bizga yozing.",
        newShop: "🏪 Yangi do'kon",
        ownerLabel: "Egasi",
        approve: "✅ Tasdiqlash",
        reject: "❌ Rad etish",
        shopStatus: {
            active: "✅ Tasdiqlandi",
            disabled: "❌ Rad etildi",
            pending: "⏳ Kutilmoqda",
        },
        callbackDone: "Tayyor",
        callbackOutdated: "Holat allaqachon o'zgargan",
        callbackForbidden: "Bu amal siz uchun emas",
        courierJoined: "✅ Siz endi {shop} kuryerisiz. Buyurtma berilganda shu yerga xabar keladi.",
        courierJoinedOwner: "🚚 Yangi kuryer qo'shildi: {name}",
        inviteInvalid: "😔 Bu taklif havolasi ishlamaydi. Do'kon egasidan yangisini so'rang.",
        myDeliveries: "🚚 Yetkazishlarim",
        courierCard: "🚚 Yetkazib berish",
        collect: "💵 Mijozdan olish: {sum}",
        bottlesToCollect: "🔁 Bo'sh idish olish: {n} ta",
        courierActions: {
            [OrderStatus.PICKED_UP]: "🚚 Oldim",
            [OrderStatus.DELIVERED]: "🏁 Yetkazdim",
        } as StatusTexts,
        courierWait: "⏳ Buyurtma tayyor bo'lganda xabar beramiz.",
        courierReady: "📦 #{n} buyurtma tayyor — olib keting.",
        courierRemoved: "↩️ #{n} buyurtma boshqa kuryerga berildi.",
    },
    [Language.RU]: {
        currency: "сум",
        newOrder: "🆕 Новый заказ",
        order: "Заказ",
        delivery: "Доставка",
        deposit: "Залог за бутыли",
        free: "бесплатно",
        total: "Итого",
        landmark: "ориентир",
        map: "Открыть на карте",
        status: "Статус",
        courier: "Доставщик",
        bottlesBack: "Вернёт пустых бутылей: {n}",
        cancelledByCustomer: "❌ Клиент отменил заказ",
        cancel: "❌ Отменить",
        reason: "Причина",
        kg: "кг",
        statusNames: {
            [OrderStatus.PENDING]: "🆕 Новый",
            [OrderStatus.ACCEPTED]: "✅ Принят",
            [OrderStatus.PREPARING]: "📦 Собираем",
            [OrderStatus.READY]: "📦 Готов",
            [OrderStatus.PICKED_UP]: "🚚 В пути",
            [OrderStatus.DELIVERED]: "🏁 Доставлен",
            [OrderStatus.CANCELLED]: "❌ Отменён",
        } as Record<OrderStatus, string>,
        actions: {
            [OrderStatus.ACCEPTED]: "✅ Принять",
            [OrderStatus.PREPARING]: "📦 Собрать",
            [OrderStatus.READY]: "📦 Готово",
            [OrderStatus.PICKED_UP]: "🚚 Отправить",
            [OrderStatus.DELIVERED]: "🏁 Доставлен",
        } as StatusTexts,
        customerStatus: {
            [OrderStatus.ACCEPTED]: "✅ Заказ #{n} принят.",
            [OrderStatus.PREPARING]: "📦 Собираем заказ #{n}.",
            [OrderStatus.READY]: "📦 Заказ #{n} готов.",
            [OrderStatus.PICKED_UP]: "🚚 Заказ #{n} в пути. Скоро будет у вас!",
            [OrderStatus.DELIVERED]: "🏁 Заказ #{n} доставлен. Спасибо!",
            [OrderStatus.CANCELLED]: "❌ Заказ #{n} отменён.",
        } as StatusTexts,
        courierOnTheWay: "🚚 Заказ #{n} везёт {courier}.",
        shopWelcome: "Здравствуйте! Откройте каталог {shop} и закажите в пару нажатий.",
        openMenu: "🛒 Открыть каталог",
        phoneSaved: "✅ Ваш номер сохранён.",
        platformWelcome:
            "LLS — магазины вашего района в одном месте. Найдите товар и закажите в магазине.\n\nВы владелец магазина? Подключите свой бот для заказов.",
        connectShop: "🏪 Подключить магазин",
        openShowcase: "🔍 Магазины и товары",
        showcaseOrder: "🛍 Из витрины LLS · комиссия {rate}%: {sum}",
        showcaseJoined:
            "🛍 {shop} теперь в витрине LLS. Клиенты найдут вас в боте LLS.\nКомиссия: {rate}% от товаров, проданных через витрину. С продаж через ваш бот комиссии нет.",
        showcaseLeft: "{shop} убран из витрины LLS.",
        showcaseUsage:
            "Команда: /market <slug> <процент>, например /market osh-markaz 5\nУбрать: /market <slug> off",
        showcaseSet: "✅ {shop}: в витрине, комиссия {rate}%",
        showcaseOff: "✅ {shop}: убран из витрины",
        applicationReceived: "✅ Заявка {shop} принята. Сообщим после проверки.",
        shopApproved: "🎉 {shop} запущен! Отправьте клиентам эту ссылку:",
        shopRejected: "😔 Заявка {shop} отклонена. Если есть вопросы, напишите нам.",
        newShop: "🏪 Новый магазин",
        ownerLabel: "Владелец",
        approve: "✅ Одобрить",
        reject: "❌ Отклонить",
        shopStatus: { active: "✅ Одобрен", disabled: "❌ Отклонён", pending: "⏳ Ждёт проверки" },
        callbackDone: "Готово",
        callbackOutdated: "Статус уже изменился",
        callbackForbidden: "Это действие не для вас",
        courierJoined: "✅ Теперь вы доставщик {shop}. Заказы будут приходить сюда.",
        courierJoinedOwner: "🚚 Новый доставщик: {name}",
        inviteInvalid: "😔 Эта ссылка-приглашение не работает. Попросите у владельца новую.",
        myDeliveries: "🚚 Мои доставки",
        courierCard: "🚚 Доставка",
        collect: "💵 Взять с клиента: {sum}",
        bottlesToCollect: "🔁 Забрать пустых бутылей: {n}",
        courierActions: {
            [OrderStatus.PICKED_UP]: "🚚 Забрал",
            [OrderStatus.DELIVERED]: "🏁 Доставил",
        } as StatusTexts,
        courierWait: "⏳ Сообщим, когда заказ будет готов.",
        courierReady: "📦 Заказ #{n} готов — можно забирать.",
        courierRemoved: "↩️ Заказ #{n} передан другому доставщику.",
    },
}

export type BotTexts = (typeof BASE)[Language]

/** Food shops cook; water and grocery shops collect goods. Only these words differ. */
const FOOD: Record<Language, Partial<BotTexts>> = {
    [Language.UZ]: {
        statusNames: { ...BASE.uz.statusNames, [OrderStatus.PREPARING]: "👨‍🍳 Tayyorlanmoqda" },
        actions: { ...BASE.uz.actions, [OrderStatus.PREPARING]: "👨‍🍳 Tayyorlashni boshlash" },
        customerStatus: {
            ...BASE.uz.customerStatus,
            [OrderStatus.PREPARING]: "👨‍🍳 #{n} buyurtmangiz tayyorlanmoqda.",
            [OrderStatus.DELIVERED]: "🏁 #{n} buyurtmangiz yetkazildi. Yoqimli ishtaha!",
        },
        shopWelcome:
            "Assalomu alaykum! {shop} menyusini oching va bir necha bosishda buyurtma bering.",
        openMenu: "🍽 Menyuni ochish",
    },
    [Language.RU]: {
        statusNames: { ...BASE.ru.statusNames, [OrderStatus.PREPARING]: "👨‍🍳 Готовится" },
        actions: { ...BASE.ru.actions, [OrderStatus.PREPARING]: "👨‍🍳 Начать готовить" },
        customerStatus: {
            ...BASE.ru.customerStatus,
            [OrderStatus.PREPARING]: "👨‍🍳 Заказ #{n} готовится.",
            [OrderStatus.DELIVERED]: "🏁 Заказ #{n} доставлен. Приятного аппетита!",
        },
        shopWelcome: "Здравствуйте! Откройте меню {shop} и закажите в пару нажатий.",
        openMenu: "🍽 Открыть меню",
    },
}

/** Texts in the reader's language, worded for the shop's kind of business. */
export function textsFor(language: Language, type?: BusinessType): BotTexts {
    return type === BusinessType.FOOD ? { ...BASE[language], ...FOOD[language] } : BASE[language]
}

/** "{shop}" / "#{n}" placeholders. */
export function fill(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) =>
        key in values ? String(values[key]) : match,
    )
}
