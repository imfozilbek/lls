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
            [OrderStatus.ACCEPTED]: "✅ To'lov keldi, #{n} buyurtmangiz qabul qilindi.",
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
        botNotConnected:
            "⚠️ {shop} tasdiqlandi, lekin bot ulanmadi: {reason}\nQayta urinish: /reconnect {slug}",
        botConnected: "✅ {shop}: bot ulandi.",
        reconnectUsage: "Buyruq: /reconnect <slug>, masalan /reconnect osh-markaz",
        shopNotActive: "{shop} hali tasdiqlanmagan.",
        alertServerError: "🚨 LLS serverida xato",
        alertNotificationFailed: "🚨 LLS: xabar yuborilmadi",
        alertQuiet: "Shu turdagi keyingi ogohlantirish {minutes} daqiqadan keyin.",
        applicationReceived: "✅ {shop} arizasi qabul qilindi. Tekshiruvdan so'ng xabar beramiz.",
        shopApproved: "🎉 {shop} ishga tushdi! Mijozlaringizga ushbu havolani yuboring:",
        shopRejected: "😔 {shop} arizasi rad etildi. Savollar bo'lsa, bizga yozing.",
        newShop: "🏪 Yangi do'kon",
        shopTypes: {
            [BusinessType.FOOD]: "ovqat",
            [BusinessType.WATER]: "suv",
            [BusinessType.GROCERY]: "oziq-ovqat",
        } as Record<BusinessType, string>,
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
        courierBotWelcome:
            "👋 Bu LLS kuryer boti: do'konlar buyurtmalari shu yerga keladi. Ishni boshlash uchun do'kon egasidan taklif havolasini so'rang.",
        courierBotHome:
            "🚚 Siz kuryersiz: {shops}. Smenaga chiqing — buyurtmalar shu yerga keladi.",
        courierPending:
            "⏳ {shop} egasi sizni tasdiqlashini kuting. Tasdiqlansa, shu yerga yozamiz.",
        courierAskPhone: "📱 Do'kon siz bilan bog'lana olishi uchun telefon raqamingizni yuboring.",
        sharePhone: "📱 Raqamni yuborish",
        courierJoinedOwner: "🚚 {name} kuryer bo'lish taklifini qabul qildi. Tasdiqlaysizmi?",
        approveCourier: "✅ Tasdiqlash",
        declineCourier: "❌ Rad etish",
        courierApprovedOwner: "✅ {name} endi sizning kuryeringiz.",
        courierDeclinedOwner: "❌ {name} rad etildi.",
        courierApproved:
            "✅ {shop} sizni kuryer sifatida tasdiqladi. Smenaga chiqing — buyurtmalar shu yerga keladi.",
        courierDeclined: "😔 {shop} sizni kuryer sifatida tasdiqlamadi.",
        courierRemovedFromShop: "↩️ {shop} sizni kuryerlar ro'yxatidan chiqardi.",
        networkSearching: "🔎 Tuman tarmog'idan kuryer qidirilmoqda",
        networkCourier: "🚚 Tuman tarmog'i kuryeri: {name}",
        networkNew: "🛵 Yaqinda yangi buyurtma",
        networkItems: "📦 Pozitsiyalar: {n}",
        networkDistance: "📍 Mijozgacha ≈ {km} km",
        takeOrder: "🙋 Olaman",
        networkTaken: "✅ {shop}: #{n} buyurtmani boshqa kuryer oldi.",
        networkYours: "🎉 {shop}: #{n} buyurtma sizniki — karta pastda.",
        networkRequestedOwner:
            "🔎 Bo'sh kuryeringiz yo'q: #{n} buyurtma tuman tarmog'iga berildi. Kim olsa, xabar beramiz.",
        networkClaimedOwner: "🚚 #{n} buyurtmani tuman tarmog'i kuryeri olib boradi: {name}",
        networkOverdueOwner:
            "⏰ #{n} buyurtma {min} daqiqadan beri tarmoq kuryerini kutmoqda. O'z kuryeringizni tayinlang yoki o'zingiz olib boring.",
        networkOverdueAdmin: "⏰ {shop}: #{n} buyurtma {min} daqiqa kuryersiz ({district}).",
        networkInvite:
            "🤝 Tumanning boshqa do'konlari uchun ham yetkazasizmi? Buyurtma shu yerga keladi — qulay bo'lsagina olasiz.",
        joinNetwork: "✅ Ha, tuman uchun",
        skipNetwork: "Hozir emas",
        networkJoined:
            "✅ Siz tuman tarmog'idasiz. Smenaga chiqing — yaqindagi buyurtmalar shu yerga keladi.",
        networkSkipped: "Yaxshi. «Yetkazishlarim»da yoqish mumkin.",
        callbackTaken: "Bu buyurtmani allaqachon olishdi",
        districtUsage:
            "Format: /district <nom> <kenglik>,<uzunlik> <km> yoki /district <nom> wait <daqiqa>",
        districtSaved:
            "📍 {name} tumani: radius {km} km, kutish {min} daqiqa. Ichidagi do'konlar: {shops}.",
        networkReportTitle: "📊 Tuman tarmog'i, 7 kun",
        networkReportLine:
            "<b>{name}</b> ({km} km): bo'sh kuryerlar {free}, kutayotgan buyurtmalar {waiting}; yetkazildi {delivered}, shundan tarmoq {network}",
        networkNoDistricts:
            "Hali tumanlar yo'q. Qo'shish: /district <nom> <kenglik>,<uzunlik> <km>",
        inviteInvalid: "😔 Bu taklif havolasi ishlamaydi. Do'kon egasidan yangisini so'rang.",
        myDeliveries: "🚚 Yetkazishlarim",
        courierCard: "🚚 Yetkazib berish",
        bottlesToCollect: "🔁 Bo'sh idish olish: {n} ta",
        courierActions: {
            [OrderStatus.PICKED_UP]: "🚚 Oldim",
            [OrderStatus.DELIVERED]: "🏁 Yetkazdim",
        } as StatusTexts,
        courierWait: "⏳ Buyurtma tayyor bo'lganda xabar beramiz.",
        courierReady: "📦 {shop}: #{n} buyurtma tayyor — olib keting.",
        payment: {
            unpaid: "💳 Kartaga o'tkazma kutilmoqda",
            sent: "💳 Mijoz o'tkazdim dedi — kartani tekshiring",
            paid: "✅ O'tkazma bilan to'langan",
            refundDue: "↩️ Mijozga qaytarish kerak",
            refunded: "↩️ Qaytarildi",
        },
        paidAccept: "💳 Pul keldi — qabul qilish",
        nothingToCollect: "✅ Oldindan to'langan — mijozdan pul olmang",
        transferSentOwner: "💳 Mijoz #{n} buyurtma uchun {sum} o'tkazdi. Kartani tekshiring.",
        payByTransfer:
            "🧾 #{n} buyurtma rasmiylashtirildi.\nKartaga {sum} o'tkazing:\n<code>{card}</code> ({holder})\nSo'ng ilovada «O'tkazdim» ni bosing — pul kelishi bilan do'kon boshlaydi.",
        reportCaption: "📊 {shop}: buyurtmalar, {from} — {to}",
        csv: {
            headers: [
                "Raqam",
                "Sana",
                "Holat",
                "Mijoz",
                "Telefon",
                "Manzil",
                "Tovarlar",
                "Yetkazish",
                "Garov",
                "Jami",
                "To'lov holati",
                "To'langan vaqt",
                "Kuryer",
                "Kanal",
                "LLS komissiyasi",
            ],
            payment: {
                unpaid: "to'lanmagan",
                awaiting: "kutilmoqda",
                paid: "to'langan",
                refund_due: "qaytarish kerak",
                refunded: "qaytarildi",
            },
            channel: { shop_bot: "do'kon boti", marketplace: "LLS vitrinasi" },
        },
        posterCaption: "🖨 {shop} uchun QR-kod. Chop eting yoki Instagramga joylang.",
        courierRemoved: "↩️ {shop}: #{n} buyurtma boshqa kuryerga berildi.",
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
            [OrderStatus.ACCEPTED]: "✅ Оплата получена, заказ #{n} принят.",
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
        botNotConnected:
            "⚠️ {shop} одобрен, но бот не подключился: {reason}\nПовторить: /reconnect {slug}",
        botConnected: "✅ {shop}: бот подключён.",
        reconnectUsage: "Команда: /reconnect <slug>, например /reconnect osh-markaz",
        shopNotActive: "{shop} ещё не одобрен.",
        alertServerError: "🚨 Ошибка на сервере LLS",
        alertNotificationFailed: "🚨 LLS: сообщение не отправлено",
        alertQuiet: "Следующее оповещение этого вида не раньше чем через {minutes} мин.",
        applicationReceived: "✅ Заявка {shop} принята. Сообщим после проверки.",
        shopApproved: "🎉 {shop} запущен! Отправьте клиентам эту ссылку:",
        shopRejected: "😔 Заявка {shop} отклонена. Если есть вопросы, напишите нам.",
        newShop: "🏪 Новый магазин",
        shopTypes: {
            [BusinessType.FOOD]: "еда",
            [BusinessType.WATER]: "вода",
            [BusinessType.GROCERY]: "продукты",
        } as Record<BusinessType, string>,
        ownerLabel: "Владелец",
        approve: "✅ Одобрить",
        reject: "❌ Отклонить",
        shopStatus: { active: "✅ Одобрен", disabled: "❌ Отклонён", pending: "⏳ Ждёт проверки" },
        callbackDone: "Готово",
        callbackOutdated: "Статус уже изменился",
        callbackForbidden: "Это действие не для вас",
        courierBotWelcome:
            "👋 Это бот доставщиков LLS: сюда приходят заказы магазинов. Чтобы начать, попросите у владельца магазина ссылку-приглашение.",
        courierBotHome: "🚚 Вы доставщик: {shops}. Выйдите на смену — заказы будут приходить сюда.",
        courierPending: "⏳ Ждём, пока владелец {shop} вас подтвердит. Напишем сюда.",
        courierAskPhone: "📱 Отправьте номер телефона, чтобы магазин мог вам позвонить.",
        sharePhone: "📱 Отправить номер",
        courierJoinedOwner: "🚚 {name} принял приглашение стать доставщиком. Подтвердить?",
        approveCourier: "✅ Подтвердить",
        declineCourier: "❌ Отклонить",
        courierApprovedOwner: "✅ {name} теперь ваш доставщик.",
        courierDeclinedOwner: "❌ {name}: отклонён.",
        courierApproved:
            "✅ {shop} подтвердил вас как доставщика. Выйдите на смену — заказы будут приходить сюда.",
        courierDeclined: "😔 {shop} не подтвердил вас как доставщика.",
        courierRemovedFromShop: "↩️ {shop} убрал вас из своих доставщиков.",
        networkSearching: "🔎 Ищем доставщика сети района",
        networkCourier: "🚚 Доставщик сети района: {name}",
        networkNew: "🛵 Новый заказ рядом",
        networkItems: "📦 Позиций: {n}",
        networkDistance: "📍 До клиента ≈ {km} км",
        takeOrder: "🙋 Беру",
        networkTaken: "✅ {shop}: заказ #{n} уже взял другой доставщик.",
        networkYours: "🎉 {shop}: заказ #{n} ваш — карточка ниже.",
        networkRequestedOwner:
            "🔎 Свободного доставщика у вас нет: заказ #{n} отдан сети района. Напишем, кто возьмёт.",
        networkClaimedOwner: "🚚 Заказ #{n} везёт доставщик сети района: {name}",
        networkOverdueOwner:
            "⏰ Заказ #{n} уже {min} мин ждёт доставщика сети. Назначьте своего или отвезите сами.",
        networkOverdueAdmin: "⏰ {shop}: заказ #{n} {min} мин без доставщика ({district}).",
        networkInvite:
            "🤝 Хотите возить и для других точек района? Заказ придёт сюда — берёте, только если удобно.",
        joinNetwork: "✅ Да, для района",
        skipNetwork: "Не сейчас",
        networkJoined: "✅ Вы в сети района. Выйдите на смену — заказы рядом будут приходить сюда.",
        networkSkipped: "Хорошо. Включить можно в «Мои доставки».",
        callbackTaken: "Этот заказ уже взяли",
        districtUsage:
            "Формат: /district <название> <широта>,<долгота> <км> или /district <название> wait <минут>",
        districtSaved:
            "📍 Район {name}: радиус {km} км, ожидание {min} мин. Точек внутри: {shops}.",
        networkReportTitle: "📊 Сеть района за 7 дней",
        networkReportLine:
            "<b>{name}</b> ({km} км): свободных доставщиков {free}, ждут {waiting}; доставлено {delivered}, из них сетью {network}",
        networkNoDistricts:
            "Районов пока нет. Добавить: /district <название> <широта>,<долгота> <км>",
        inviteInvalid: "😔 Эта ссылка-приглашение не работает. Попросите у владельца новую.",
        myDeliveries: "🚚 Мои доставки",
        courierCard: "🚚 Доставка",
        bottlesToCollect: "🔁 Забрать пустых бутылей: {n}",
        courierActions: {
            [OrderStatus.PICKED_UP]: "🚚 Забрал",
            [OrderStatus.DELIVERED]: "🏁 Доставил",
        } as StatusTexts,
        courierWait: "⏳ Сообщим, когда заказ будет готов.",
        courierReady: "📦 {shop}: заказ #{n} готов — можно забирать.",
        payment: {
            unpaid: "💳 Ждём перевод на карту",
            sent: "💳 Клиент говорит, что перевёл — проверьте карту",
            paid: "✅ Оплачено переводом",
            refundDue: "↩️ Нужно вернуть клиенту",
            refunded: "↩️ Возвращено",
        },
        paidAccept: "💳 Деньги пришли — принять",
        nothingToCollect: "✅ Оплачено заранее — денег с клиента не брать",
        transferSentOwner: "💳 Клиент перевёл {sum} за заказ #{n}. Проверьте карту.",
        payByTransfer:
            "🧾 Заказ #{n} оформлен.\nПереведите {sum} на карту:\n<code>{card}</code> ({holder})\nПотом нажмите «Я перевёл» в приложении — магазин начнёт, как только деньги придут.",
        reportCaption: "📊 {shop}: заказы, {from} — {to}",
        csv: {
            headers: [
                "Номер",
                "Дата",
                "Статус",
                "Клиент",
                "Телефон",
                "Адрес",
                "Товары",
                "Доставка",
                "Залог",
                "Итого",
                "Оплата",
                "Оплачено",
                "Доставщик",
                "Канал",
                "Комиссия LLS",
            ],
            payment: {
                unpaid: "не оплачено",
                awaiting: "ждём",
                paid: "оплачено",
                refund_due: "вернуть",
                refunded: "возвращено",
            },
            channel: { shop_bot: "бот магазина", marketplace: "витрина LLS" },
        },
        posterCaption: "🖨 QR-код {shop}. Распечатайте или выложите в Instagram.",
        courierRemoved: "↩️ {shop}: заказ #{n} передан другому доставщику.",
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
