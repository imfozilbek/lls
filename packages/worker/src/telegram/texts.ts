import { BusinessType, Language, OrderStatus } from "@zumda/core"

type StatusTexts = Partial<Record<OrderStatus, string>>

/**
 * Bot message texts: Uzbek (Latin) only (owner's decision). Another language is one more
 * dictionary here, keyed by `Language`.
 */
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
        moreItems: "… va yana {n} ta",
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
        shopOpensSoon:
            "Assalomu alaykum! {shop} tez orada ochiladi. Katalogni hozir ko'rib chiqishingiz mumkin, buyurtmalar ochilgandan keyin.",
        openMenu: "🛒 Katalogni ochish",
        phoneSaved: "✅ Telefon raqamingiz saqlandi.",
        platformWelcome:
            "<b>Zumda: tumaningizdagi do'konlar, oshxonalar va xizmatlar bir joyda.</b>\n\nQidiring, buyurtma bering: eshigingizgacha olib kelamiz.",
        businessWelcome:
            "<b>Zumda Business: do'koningiz, oshxonangiz yoki xizmatingiz uchun o'z buyurtma boti.</b>\n\nBotni shu yerda bir tugma bilan yarating: token kerak emas. Menyu, buyurtmalar, pul va kuryerlar: hammasi «Mening bizneslarim»da.",
        openBusinesses: "🏪 Mening bizneslarim",
        openShowcase: "🔍 Qidirish va buyurtma berish",
        showcaseOrder: "🛍 Zumda vitrinasidan · komissiya {rate}%: {sum}",
        cardAddedOwner:
            "💳 {shop}: yangi karta qo'shildi, {card}.\nBuni siz qilmagan bo'lsangiz, darhol Zumda'ga yozing.",
        paymentCardOwner:
            "💳 {shop}: mijozlar endi {card} kartasiga to'laydi.\nBuni siz qilmagan bo'lsangiz, darhol Zumda'ga yozing.",
        showcaseJoined:
            "🛍 {shop} Zumda vitrinasiga qo'shildi. Mijozlar uni Zumda botida topadi.\nKomissiya: vitrina orqali sotilgan tovarlarning {rate}%. O'z botingiz orqali sotuvdan komissiya olinmaydi.",
        showcaseLeft: "{shop} Zumda vitrinasidan olindi.",
        botNotConnected:
            "⚠️ {shop} tasdiqlandi, lekin bot ulanmadi: {reason}\n«Platforma»da «Botni qayta ulash»ni bosing.",
        openPlatform: "🛠 Platformani ochish",
        openApplication: "📋 Arizani ochish",
        openOrder: "📱 Buyurtmani ochish",
        openInApp: "📱 Ilovada ochish",
        startCommand: "Boshlash",
        onlyInApp: "Bu yerga xabarlar keladi, ish esa ilovada: pastdagi tugmani bosing 👇",
        alertServerError: "🚨 Zumda serverida xato",
        alertNotificationFailed: "🚨 Zumda: xabar yuborilmadi",
        alertClientError: "🚨 Zumda ilovasida xato",
        alertQuiet: "Shu turdagi keyingi ogohlantirish {minutes} daqiqadan keyin.",
        applicationReceived: "✅ {shop} arizasi qabul qilindi. Tekshiruvdan so'ng xabar beramiz.",
        managedBotButton: "🤖 Bot yaratish",
        managedBotCreated:
            "✅ {bot} yaratildi. Zumda ilovasiga qayting va arizani davom ettiring: tokenni hech qayerga ko'chirish shart emas.",
        continueSetup: "➡️ Davom etish",
        managedBotOwnerChanged:
            "⚠️ {shop}: {bot} botining egasi o'zgardi, yangi egasi {owner}. Do'kon avvalgi egasida qoldi: kerak bo'lsa, tekshiring.",
        shopBotDescription:
            "{shop}: buyurtmalarni shu yerda qabul qilamiz.\nPastdagi «{openMenu}» tugmasini bosing: tanlang, buyurtma bering, eshigingizgacha olib kelamiz.\n\nZumda asosida ishlaydi · zumda.shop",
        shopBotShortDescription: "{shop}: uyga buyurtma bering. Zumda asosida ishlaydi",
        shopApproved: "🎉 {shop} ishga tushdi! Mijozlaringizga ushbu havolani yuboring:",
        shopApprovedNeedsCard:
            "Mijozlar buyurtma berishi uchun to'lov kartasini qo'shing: «Ishga tayyor» ro'yxatida.",
        shopRejected: "😔 {shop} arizasi rad etildi.",
        shopRejectedReason: "Sabab: {reason}",
        shopRejectedNext: "Tuzating va «Mening bizneslarim»da arizani qayta yuboring.",
        openShop: "🏪 Biznesni ochish",
        newShop: "🏪 Yangi biznes",
        shopTypes: {
            [BusinessType.GROCERY]: "oziq-ovqat do'koni",
            [BusinessType.FOOD]: "restoran",
            [BusinessType.SERVICE]: "xizmat ko'rsatish",
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
            "<b>Zumda kuryer boti.</b>\n\nTumandagi do'kon, oshxona va xizmatlar buyurtmalari shu yerga keladi. Ishni boshlash uchun biznes egasidan taklif havolasini so'rang.",
        courierBotHome: "🚚 Siz kuryersiz: {shops}. Smenaga chiqing, buyurtmalar shu yerga keladi.",
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
            "✅ {shop} sizni kuryer sifatida tasdiqladi. Smenaga chiqing, buyurtmalar shu yerga keladi.",
        courierDeclined: "😔 {shop} sizni kuryer sifatida tasdiqlamadi.",
        courierRemovedFromShop: "↩️ {shop} sizni kuryerlar ro'yxatidan chiqardi.",
        networkSearching: "🔎 Tuman tarmog'idan kuryer qidirilmoqda",
        networkCourier: "🚚 Tuman tarmog'i kuryeri: {name}",
        networkNew: "🛵 Yaqinda yangi buyurtma",
        networkItems: "📦 Pozitsiyalar: {n}",
        networkDistance: "📍 Mijozgacha ≈ {km} km",
        takeOrder: "🙋 Olaman",
        networkTaken: "✅ {shop}: #{n} buyurtmani boshqa kuryer oldi.",
        networkYours: "🎉 {shop}: #{n} buyurtma sizniki, karta pastda.",
        networkRequestedOwner:
            "🔎 Bo'sh kuryeringiz yo'q: #{n} buyurtma tuman tarmog'iga berildi. Kim olsa, xabar beramiz.",
        networkClaimedOwner: "🚚 #{n} buyurtmani tuman tarmog'i kuryeri olib boradi: {name}",
        networkOverdueOwner:
            "⏰ #{n} buyurtma {min} daqiqadan beri tarmoq kuryerini kutmoqda. O'z kuryeringizni tayinlang yoki o'zingiz olib boring.",
        networkOverdueAdmin: "⏰ {shop}: #{n} buyurtma {min} daqiqa kuryersiz ({district}).",
        networkInvite:
            "🤝 Tumanning boshqa do'konlari uchun ham yetkazasizmi? Buyurtma shu yerga keladi, qulay bo'lsagina olasiz.",
        joinNetwork: "✅ Ha, tuman uchun",
        skipNetwork: "Hozir emas",
        networkJoined:
            "✅ Siz tuman tarmog'idasiz. Smenaga chiqing, yaqindagi buyurtmalar shu yerga keladi.",
        networkSkipped: "Yaxshi. «Yetkazishlarim»da yoqish mumkin.",
        callbackTaken: "Bu buyurtmani allaqachon olishdi",
        inviteInvalid: "😔 Bu taklif havolasi ishlamaydi. Do'kon egasidan yangisini so'rang.",
        myDeliveries: "🚚 Yetkazishlarim",
        courierCard: "🚚 Yetkazib berish",
        bottlesToCollect: "🔁 Bo'sh idish olish: {n} ta",
        courierActions: {
            [OrderStatus.PICKED_UP]: "🚚 Oldim",
            [OrderStatus.DELIVERED]: "🏁 Yetkazdim",
        } as StatusTexts,
        courierWait: "⏳ Buyurtma tayyor bo'lganda xabar beramiz.",
        courierReady: "📦 {shop}: #{n} buyurtma tayyor, olib keting.",
        payment: {
            unpaid: "💳 Kartaga o'tkazma kutilmoqda",
            sent: "💳 Mijoz o'tkazdim dedi, kartani tekshiring",
            paid: "✅ O'tkazma bilan to'langan",
            refundDue: "↩️ Mijozga qaytarish kerak",
            refunded: "↩️ Qaytarildi",
            cashUnpaid: "💵 Naqd: kuryer yetkazganda oladi",
            cashWithCourier: "💵 Naqd olindi, pul kuryerda",
            cashReceived: "✅ Naqd pul do'konda",
        },
        collectCash: "💵 Mijozdan {sum} naqd oling",
        cashDelivered: "🏁 Pulni oldim, yetkazdim",
        payByCash:
            "🧾 #{n} buyurtma rasmiylashtirildi.\nTo'lov naqd: kuryerga {sum} berasiz. Do'kon qabul qilishi bilan xabar beramiz.",
        paidAccept: "💳 Pul keldi, qabul qilish",
        nothingToCollect: "✅ Oldindan to'langan, mijozdan pul olmang",
        transferSentOwner: "💳 Mijoz #{n} buyurtma uchun {sum} o'tkazdi. Kartani tekshiring.",
        receiptCaption:
            "🧾 #{n} · {sum} · {name}\nChek: bu dalil emas. Pul {card} kartangizga kelganini bank ilovangizda tekshiring.",
        receiptReusedHere: "⚠️ Bu chek avval #{n} buyurtmada yuborilgan.",
        receiptReusedElsewhere: "⚠️ Bu chek boshqa do'kon buyurtmasida ham yuborilgan.",
        customerRejected: "⚠️ Bu mijozning {count} ta o'tkazmasi avval topilmagan.",
        confirmPaidQuestion:
            "💳 #{n}: {sum} {card} kartangizga keldimi?\nBank ilovangizda tekshirib, javob bering.",
        confirmPaidNoReceipt: "⚠️ Mijoz o'tkazganini hali bildirmagan.",
        transferReminder: "⏰ #{n}: mijoz o'tkazmani tekshirishingizni kutmoqda.",
        confirmPaidYes: "✅ Ha, {sum} keldi",
        confirmPaidNo: "Yo'q, kelmadi",
        transferRejectedCustomer:
            "Do'kon #{n} buyurtma uchun pulni topmadi. Kartangizdan o'tganini tekshiring va chekni qayta yuboring.",
        transferRejectedOwner: "#{n}: «Pul kelmadi» belgilandi. Mijozdan chekni qayta so'radik.",
        payByTransfer:
            "🧾 #{n} buyurtma rasmiylashtirildi.\nKartaga {sum} o'tkazing:\n{system}<code>{card}</code> ({holder})\nSo'ng ilovada «O'tkazdim» ni bosing. Pul kelishi bilan do'kon boshlaydi.",
        /** A card's system before its number; Zumda does not know every card (then nothing). */
        cardSystems: {
            humo: "Humo",
            uzcard: "Uzcard",
            visa: "Visa",
            mastercard: "Mastercard",
            unionpay: "UnionPay",
            mir: "Mir",
        },
        reportCaption: "📊 {shop}: buyurtmalar, {from} - {to}",
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
                "To'lov usuli",
                "To'lov holati",
                "To'langan vaqt",
                "Kuryer",
                "Kanal",
                "Zumda komissiyasi",
            ],
            payment: {
                unpaid: "to'lanmagan",
                awaiting: "kutilmoqda",
                paid: "to'langan",
                refund_due: "qaytarish kerak",
                refunded: "qaytarildi",
            },
            method: { card_transfer: "karta", cash: "naqd" },
            channel: { shop_bot: "do'kon boti", marketplace: "Zumda vitrinasi" },
        },
        posterCaption: "🖨 {shop} uchun QR-kod. Chop eting yoki Instagramga joylang.",
        posterZumdaCaption:
            "🖨 {shop}: Zumda Shop uchun QR-kod. Skanerlagan odam do'koningizni Zumda Shop'da ochadi. Chop eting yoki Instagramga joylang.",
        ownerBotClosed:
            "⚠️ {bot} sizga yoza olmadi: siz unda hali Start bosmagansiz. Botingizni oching va Start bosing: keyingi xabarlar o'sha yerga keladi.",
        openShopBot: "🤖 {bot} ni ochish",
        ownerBotOpened:
            "✅ {shop}: endi buyurtmalar va xabarlar shu yerga keladi. Ish esa ilovada: pastdagi tugma.",
        openMyShop: "🏪 Mening do'konim",
        courierRemoved: "↩️ {shop}: #{n} buyurtma boshqa kuryerga berildi.",
        tripAssigned:
            "🗺 {shop}: {count} ta buyurtma bir yo'nalishda, shu tartibda: {stops}. Xarita va yo'l ilovada.",
    },
}

export type BotTexts = (typeof BASE)[Language]

/** A restaurant cooks; a grocery store collects goods. Only these words differ. */
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
}

/** Services are done, not cooked or collected; and they are «Xizmatlar», not a catalog. */
const SERVICE: Record<Language, Partial<BotTexts>> = {
    [Language.UZ]: {
        statusNames: { ...BASE.uz.statusNames, [OrderStatus.PREPARING]: "🧰 Bajarilmoqda" },
        actions: { ...BASE.uz.actions, [OrderStatus.PREPARING]: "🧰 Bajarishni boshlash" },
        customerStatus: {
            ...BASE.uz.customerStatus,
            [OrderStatus.PREPARING]: "🧰 #{n} buyurtmangiz bajarilmoqda.",
            [OrderStatus.DELIVERED]: "🏁 #{n} buyurtmangiz bajarildi. Rahmat!",
        },
        shopWelcome:
            "Assalomu alaykum! {shop} xizmatlarini oching va bir necha bosishda buyurtma bering.",
        openMenu: "🧰 Xizmatlarni ochish",
    },
}

/** The words that differ by kind of business; a grocery store uses the base words. */
const OVERLAYS: Partial<Record<BusinessType, Record<Language, Partial<BotTexts>>>> = {
    [BusinessType.FOOD]: FOOD,
    [BusinessType.SERVICE]: SERVICE,
}

/** Texts in the reader's language, worded for the shop's kind of business. */
export function textsFor(language: Language, type?: BusinessType): BotTexts {
    const overlay = type ? OVERLAYS[type]?.[language] : undefined
    return overlay ? { ...BASE[language], ...overlay } : BASE[language]
}

/** "{shop}" / "#{n}" placeholders. */
export function fill(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) =>
        key in values ? String(values[key]) : match,
    )
}
