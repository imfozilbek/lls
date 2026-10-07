# Changelog

All notable changes to Zumda will be documented in this file.

## [Unreleased]: new stack (Cloudflare) and white-label stage 1

The platform was rebuilt. The old NestJS + MongoDB API, the old bot and admin panel, and the VPS
deploy were removed; they stay available at git tag `legacy-v0`. Versions are bumped at release.

### Demo shops: one of every kind, ready to work
- The stand's demo data has a shop of every kind of business: Osh Markaz (restaurant), Baraka
  Market (grocery), Toza Suv (water: a grocery store with bottles), Toza Gilam (services) and the
  new Uy Bozori («Do'kon (mollar)», takes a card and cash).
- Each one has nothing left in «Ishga tayyor»:
  - card, hours, contact phone, logo (`scripts/demo-logos/`, put into the local R2 on every
    seed), at least three products and a courier;
  - its own address in Yakkabog'.
- Their catalogs show what their kind can do: portions with add-ons, 100 g spices, car sizes,
  lamp wattages, metres of cable, pairs, product descriptions.
- A shop open from `00:00` to `00:00` reads «Bugun kecha-kunduz ochiq» on its storefront.

### What people would hit: the audit of 7 October 2026
- **Fixed (server):**
  - an old application card in Zumda | Business no longer turns a live shop off or a turned-off
    one on;
  - a turned-off shop's owner hears «o'chirildi», not «ariza rad etildi», and its bot says it does
    not work now instead of opening an app that answers 404;
  - a failed message (a customer blocked the bot) no longer silences the rest of a trip or leaves
    a bot button spinning;
  - double taps («Беру», a card, an application) answer in words instead of 500;
  - a trip's road follows its stops after a cancel from the chat or a reassignment, and a trip
    is saved before its road is planned;
  - a new file is removed when saving it fails; old QR posters go;
  - a network courier keeps the order carried after a new invite of the same shop;
  - «Tuman qo'shish» with an existing name is refused (`DISTRICT_EXISTS`), never a silent move;
  - the showcase lists only shops with something on sale: never an empty shop.
  - a shop and its first card are written in one transaction (the application, «To'lov»): the
    payment card never names a card missing from the list, and a lost save leaves no card behind.
- **Fixed (customers):**
  - a checkout tapped again after a lost answer returns the order already placed
    (`clientOrderId`), never a second order;
  - a sheet hides Telegram's big button under it, so «O'tkazdim» behind the receipt sheet no
    longer does nothing;
  - the cart fits a changed step or unit and reloads after a deleted product;
  - a changed way of paying reloads the shop;
  - «Raqamni yuborish» says when Telegram is too old or the number did not come;
  - weight items with sizes read in grams;
  - Back closes the receipt picture first;
  - the showcase shows «… dan» and keeps its list.
- **Fixed (staff):**
  - a photo that failed never makes a product twice;
  - the order opened from a message refreshes with the list;
  - «Sozlamalar» says what is missing instead of a dead button;
  - «Qaytardim» and taking a shop out of the showcase ask first;
  - successful actions are no longer shown as failed;
  - the courier screen keeps fresh data;
  - the application wizard forgets a taken bot;
  - variants and add-ons stop at the server's limits.
- **Added:** every error code the server sends has its own Uzbek sentence (a test reads the
  server's codes); staff-only words load with the staff's chunks.

### A new logo deleted itself (fixed, 7 October 2026)
- **Fixed:** since 5 October every new shop logo was deleted right after it was saved: the route
  read the "old" key from the same object the use case had just changed. The replaced picture is
  now read before the change (`replaceImage`); tests check the file is there after upload.
- **Changed:** a logo that cannot be shown becomes the shop's letter on its color (`ShopLogo`),
  never a broken image; a logo or photo whose file is really gone (HEAD 404, not a weak network)
  reaches the server log and the admins once a session.

### The Zumda catalog and «Ro'yxat bilan qo'shish» (goal 17, parts 3 and 4)
- **Added:** the product form starts with a search of the Zumda catalog: ~3 100 dishes,
  groceries, goods and services of Uzbekistan from the October 2026 research. A pick fills the
  name, category, unit, usual variants and offered add-ons; the owner writes only the prices.
  The catalog is a static file of the app, loaded on the first search (never in the customer's
  JS). Licensed services are left out; unconfirmed words are removed.
- **Added:** «Mijoz shunday ko'radi»: the customer's row, live while the owner types, with the
  photo button; «Saqlash va yana qo'shish»; «Nusxa olish»; a typed draft asks before «back».
- **Added:** «Ro'yxat bilan qo'shish»: one product a line («Lag'mon 38000», «Pomidor 12000 kg»),
  a preview with the wrong lines marked, up to 50 at once in one D1 batch
  (`POST /api/owner/products/bulk`, 5 a minute); a name the shop already has is skipped.
- **Added:** the owner's CSV has a «Mahsulotlar» column: the goods with their picks and units
  («Latte (0,4 l · Sirop) × 2, Qora murch × 300 g»).

### Variants and add-ons (goal 17, part 2)
- **Added:** a product may have variants (one is picked, each with its own price: «0,3 / 0,4 /
  0,5 l», «Kichik / Katta», a car class) and add-ons (several, priced on top, or «bepul»). The
  owner opens «Variantlar» and «Qo'shimchalar» in the product form; with variants the product
  costs as its cheapest one and the storefront says «… so'm dan».
- **Added:** the customer picks in the product's sheet («Savatga · 22 000 so'm»); each pick is
  its own cart line; the server prices it again from the ids (`VARIANT_REQUIRED`,
  `OPTION_UNAVAILABLE`); the order line keeps the pick («0,4 l · Karamel sirop») for the owner,
  the courier, the bot and «Takrorlash». Migration `0019` (two nullable columns).

### Any product of any kind: units, grams, categories (goal 17, part 1)
- **Added:** units for every kind of goods and services: 100 g and 1 g (spices, nuts, sweets;
  saffron), 20 l bottles, qadoq, quti, bog', to'plam, juft, lotok, qop, rulon, list, metr, m²,
  m³, soat, kun, oy, seans, reys, sotix. «Boshqa» in the product form shows them all; the price
  label follows the unit («100 g narxi», «1 m² narxi»); weight items sell in gram steps.
- **Added:** 114 shared categories on four shelves (Ovqat, Oziq-ovqat, Mollar, Xizmatlar), with
  pictures for the new groups; «Boshqa bo'limlar» shows them shelf by shelf.
- **Added:** the kind of business «Do'kon (mollar)» for goods that are not food.
- **Changed:** bot messages name the unit: «× 300 g», «× 12 m²», «× 2 soat».
- **Changed:** the owner's, courier's and «Platforma» words load with their screens; a customer's
  first JS dropped from 99.9 to 93.8 KB, and the build now fails above 100 KB.

### A Zumda Shop QR on the poster (goal 16)
- **Added:** «Sozlamalar» → «Chop etish uchun QR-kod» has two buttons: «Do'kon boti uchun» (as
  before) and «Zumda Shop uchun», for a shop in the showcase. Its QR,
  `t.me/zumdashop_bot?startapp=m_<slug>`, opens Zumda Shop right on that shop; Back leads to the
  other shops; an order is a showcase order (owner's decisions: money as the showcase, the poster
  in the shop's colors).
- **Added:** a shop that left the showcase after printing: the person sees «Bu do'kon hozir
  Zumda vitrinasida yo'q» and «Do'kon botini ochish» to the shop's own bot.

### Mini App crashes reach the admins
- **Added:** an uncaught error or a lost promise in the Mini App is sent to
  `POST /api/client-errors` (once per kind a session, at most 5, no preflight): the class, the
  message without digits or other alphabets, the place in our bundle and the screen. The Worker
  cleans it again, logs one JSON line (`client_error`) and alerts the admins through
  Zumda | Business («Zumda ilovasida xato», once per 10 minutes). Never a phone, a name or a token.

### Zumda in Cloudflare's free plan
- **Changed:** no paid plans (owner's decision); the account is shared by five projects, so
  Zumda keeps to its share: 35 000 Worker requests, 1.5 M rows read and 20 000 rows written a
  day, 4 GB in R2. `docs/capacity.md` shows the day of 1 000 people and 300 orders line by line;
  `test/capacity.test.ts` measures every screen on six months of history.
- **Fixed (worker):** screens that read a shop's whole history: «Pul» (10 862 rows to 45), the
  first page of finished orders and of the customer's orders (no `COUNT(*)`), the courier's
  screen and open trips, the district network's waiting orders, the transfer screenshot check,
  the showcase search (a word table instead of `LIKE`). Migrations `0016` to `0018`.
- **Changed (worker):** an order's save writes only the columns that changed (9 rows written a
  step to 3-4); one query to sign in; bot tokens decrypted once per isolate; network offers in
  one batch; 20% of request logs kept.
- **Changed (app):** the owner's orders screen checks a small version every 20 s and reloads the
  list only when it moved; the customer's order every 30 s, the courier's screen every 45 s; the
  showcase searches from 3 letters (in the search spelling: «ош» is three) after 500 ms.
- **Changed:** transfer screenshots live in their own private bucket `zumda-receipts` and are
  deleted after 30 days (owner's decision); an old one says «Chek o'chirilgan (30 kun
  saqlanadi)»; 1280 px on the long side.
- **Changed:** photos and the map come straight from R2 at `media.zumda.shop` and
  `map.zumda.shop` (owner's decision): no Worker request per photo or map piece. The deploy adds
  the addresses, the bucket's CORS and a cache rule for the map; the map upload keeps only the
  current map and the one before.

### OpenRouteService's new address
- **Changed (worker):** trips' way along the roads is asked at `api.heigit.org/openrouteservice`:
  `api.openrouteservice.org` stops working in November 2026 (their announcement). The key stays
  the same (account.heigit.org).

### The card's system
- **Added:** Humo, Uzcard, Visa, Mastercard, UnionPay and Mir are told by the card's first digits
  (owner's decision): shown while the owner types the number, in the list of cards, to the
  customer next to the shop's card, and in the bot's transfer message. Any card is still taken
  (16 digits, the Luhn check); one of an unknown system is saved after one question.
- **Fixed (app):** a late answer with the list of cards closed the «Karta qo'shish» form the owner
  had just opened.

### The owner always hears: Zumda | Business until Start in the shop's bot
- **Fixed:** a shop whose bot was made with «Bot yaratish» and never opened by its owner got no
  QR poster («Telegram hozir javob bermadi») and lost the owner's order messages silently:
  Telegram lets a bot write first only after Start. Now every message and file for the owner goes
  through Zumda | Business in that case, with the note to press Start and a button to the bot;
  after Start the shop's own bot writes again. Migration `0015_owner_bot_chat.sql`.
- **Added (app):** «Botingizni oching» in «Ishga tayyor» (checked quietly with "typing…", ticks
  itself on return from the bot); «Platforma» marks shops whose bot cannot write to the owner.
- **Added (app):** the QR poster opens in a sheet with «Yuklab olish» (Telegram's own save
  window, a file link in a browser); it still comes to the chat too. The CSV says where it went.

### Zumda's own map and trips
- **Added:** Zumda's own map of Uzbekistan (OpenStreetMap, the Protomaps build cut by
  `go-pmtiles`), kept in our R2 and served by the Worker in byte ranges (`/map/*`): the app never
  calls an outside map server. `scripts/map-data.mjs` and the «Map» workflow (by hand, monthly)
  build and upload it; the switch to a new map is atomic (`current.json` last).
- **Added (app):** «Xaritada belgilash»: the pin stays in the middle, the person moves the map
  (no search); «Joylashuvim» from Telegram; the delivery zone as a circle, a warning outside it.
  At checkout, in the application, in «Sozlamalar → Manzil» and in «Tumanlar».
- **Added (app):** the order on the map for the courier (shop and customer; a network offer shows
  only the shop), the owner (map button, Yandex under it), the customer, and «Xarita» with the
  delivery zone on the storefront. MapLibre loads only with the first map (initial JS 98 KB).
- **Added:** trips (owner's decision): «Shu yo'nalishda yana N ta» → «Bir yo'nalish»: orders
  going one way (±35° from the shop), Zumda's order of the stops (nearest next), ↑↓ to change
  it, one courier, «Tayinlash». The way along the roads from OpenRouteService (optional
  `ORS_API_KEY`; straight lines without it). The courier: one trip card, «Hammasini oldim»,
  «Yandex Navigatorda ochish» through every stop, «Yetkazdim» per stop, one bot message. The
  owner sees delivered stops grey and can reorder those still to go. Migration `0014_trips.sql`.
- **Changed:** the pilot district is Yakkabog'; the local stand's demo shops live there.

### The Zumda sound
- **Added (app):** Zumda's own sound «Zum-da» (owner's choice of five): the two syllables of the
  name as a rising fifth on a soft bell, synthesized in the app (no file). While the app is open,
  a new order or a customer's «O'tkazdim» rings it twice for the shop; a new delivery, an order
  ready to pick up or a network order nearby, for the courier; the customer hears it once, softly,
  when the order moves. Only real news rings (never the first look or the same list again).
  «Zumda ovozi» in «Sozlamalar» and on the courier screen turns it off; turning it on plays it.

### Native feel inside Telegram
- **Added (app):** a pull down from the top refreshes the screen (the app no longer collapses:
  `disableVerticalSwipes`); a swipe right goes back (closes a sheet, a part of the settings, a
  screen) and a swipe left goes forward again, each screen at the place it was scrolled to.
  Sideways lists (category chips) keep their own swipes.
- **Fixed (app):** focusing a field no longer zooms the app (every field is 16px, the viewport
  does not scale); the caret is always dark on the light fields.
- **Changed (app):** no flicker: screens and tabs open from this session's copy and refresh
  quietly; lists rise in once per session; a seen photo never fades in again; an error after a
  refresh is a toast, not a blank screen; screens slide in from the side they come from.
- **Added (app):** Uzbek popups with a red button for what cannot be undone (cancel, remove,
  leave unsaved); Telegram asks before closing a filled checkout, unsaved settings, a half
  application or a picked receipt; refresh at once when the app comes back, no polling while it
  is collapsed; Enter goes to the next field or closes the keyboard, the focused field stays
  above it; portrait only; after a delivered order, «Do'konni bosh ekranga qo'shish».
- **Changed (app):** checkout, the order and the order list load right after the menu, so the
  first screen is lighter (initial JS 94 KB gzip).

### Cash as a way of paying, chosen by the shop
- **Added:** «Sozlamalar» → «To'lov» → «Mijoz qanday to'laydi»: «Kartaga o'tkazma» (the
  default, as before), «Naqd pul» or «Ikkalasi». A cash shop needs no card; with both, the
  customer picks one at checkout and only its rules apply (owner's decision, October 2026).
- **Added:** a cash order is accepted at once with «Qabul qilish», goes only with the shop's own
  courier or the owner (never to the district network), the courier card says «Mijozdan {sum}
  naqd oling» and «Pulni oldim, yetkazdim»; the courier's shops show «Do'konga topshirasiz».
- **Added:** «Pul» → «Kuryerlardagi naqd pul»: per courier, per order, «Pulni oldim» (asked once
  more); the totals split card and cash; the CSV has «To'lov usuli».
- **Changed:** «Ishga tayyor» asks for «To'lov usuli»; the transfer screenshot sheet loads only
  when «O'tkazdim» is pressed (the initial JS stays under 100 KB).
- **Worker:** migration `0013_cash_option.sql` (`businesses.payment_options`,
  `orders.cash_received_at`); `PATCH /api/owner/orders/:id/payment` takes `cash_received`;
  `paymentMethod` on `POST /api/orders`; rules `PAYMENT_METHOD_UNAVAILABLE`, `NOT_A_TRANSFER`,
  `CASH_NOT_FOR_NETWORK`, `CASH_NOT_WITH_COURIER`.

### Hotfix: a shop could not pick its courier
- **Fixed (app):** the courier's day switch read «Bugun ishlamaydi» and was on when the courier
  did NOT work: owners turned it on meaning "works today", and their couriers on shift were
  greyed out in «Kuryer tayinlash» («bugun ishlamaydi»). It is now «Bugun ishlaydi», on while the
  courier works today, like «Sotuvda» in the menu.
- **Changed (app):** in «Kuryer tayinlash», a courier on shift who is marked off for today can be
  picked: one tap turns them back for today and assigns the order.

### A checklist that finishes (UX phase 15, from the tenth critique, 34/40)
- **Fixed (app):** a shop open around the clock could never finish «Ish vaqti» in «Ishga tayyor»
  (24/7 is stored as "no hours"): the row offers «Kecha-kunduz ochiqmiz», and saving the hours
  in «Sozlamalar» ticks it too, like «O'zim yetkazaman». The progress bar counts the required
  steps, as its label does.
- **Changed (app):** the owner's order card shows three lines and «Yana N ta mahsulot», with
  the time, the customer and the wait on one line; a courier outside the network sees that
  choice right under «Smenadaman».

### The oldest order first (UX phase 14, from the ninth critique)
- **Changed (app):** the owner's active orders run oldest first after the money checks, and each
  open order says how long it has waited («12 daqiqa kutmoqda», the clock amber after 30).
- **Added (app):** the owner's menu by its sections, with a search once the catalog is long
  (the same search as the storefront).
- **Changed (app):** the stop-list button is a clock («Sotuvdan olish»), not «…»; the owner's
  payment line says «Chek yuborildi» next to the «Tekshiring» badge; past the usual wait the
  customer reads «Do'kon odatdagidan kechikmoqda» instead of «5-10 daqiqa»; with a pin the street
  field says a landmark is enough; the storefront list rows no longer bend their dividers; the
  courier's «Transport» saves after a short pause too; «Hozirgina chiqdi» on a network offer.
- **Not done (owner's decision needed):** an expected delivery time on the storefront and the
  order: a new feature.

### Closer to the product (UX phase 13, from the eighth critique)
- **Added (app):** a tap on a product's name opens it up close: the whole photo, the whole
  description, the price and «Qo'shish» or the stepper.
- **Changed (app):** a product tapped in the showcase opens its shop on that product, scrolled
  into view and glowing for a moment.
- **Changed (app):** with the pin set, a landmark is enough when a home has no street and number
  (it is sent as the address); «Ishga tayyor» counts and points to the required steps only; the
  money sheet shows the screenshot large enough to read the sum; the screenshot tip goes away
  once a picture is chosen; status badges never wrap; an order not yet transferred says so once
  on the owner's card.

### No paid order from outside the zone (UX phase 12, from the seventh critique)
- **Changed (core, worker, app):** a shop with a delivery radius and its own location needs the
  customer's pin (`LOCATION_REQUIRED`, 422) instead of skipping the check: an order from outside
  the zone is never paid and then refunded. The radius reaches the storefront («3 km gacha
  yetkazamiz») and checkout («Majburiy: do'kon 3 km gacha yetkazadi»); the out-of-zone error
  carries the distance and the radius.
- **Changed (core):** the network offer counts the pieces to carry (two portions are two), one
  package per weighed item.
- **Changed (app):** the cart's button says «Davom etish» and is never dead: below the minimum or
  while the shop is closed a tap says why; the screenshot tip covers Android and iPhone; the
  owner's «Pul keldi» without a screenshot is a visible button; «Ishga tayyor» marks the phone
  and the logo «Ixtiyoriy» and goes away once the rest is done; the owner's menu shows every
  unit.

### Remembered and steady (UX phase 11, from the sixth critique)
- **Changed (app):** checkout remembers the map pin and, for water, the bottles handed back last
  time (never past what the order allows, never on an order without bottles); the bottles come
  before the comment, near the total.
- **Changed (app):** the network courier's card says «masofa noma'lum» when the customer set no
  pin (it still shows nothing about the customer before «Olaman»).
- **Changed (app):** the owner's tabs stay right under the shop's name on every tab; «kuryer
  qidirilmoqda» says «Hozirgina so'raldi» in the first minute and advises delivering yourself
  only after the district's usual wait.
- **Changed (app):** «Savatni tozalash» asks first; the courier's «Transport» says it saved; the
  «Buyurtma qabul qilish» card wears the shop's color.
- **Not changed:** the customer's order screen already refreshes every 20 s while the order is
  open (the critique missed the timer).

### Faster for the owner, never stuck for the customer (UX phase 10, from the fifth critique)
- **Changed (app):** «Ishga tayyor» asks for «Mijozlar uchun telefon» right after the card, so a
  customer told «Pul kelmadi» has someone to call (still optional: orders never wait for it).
- **Changed (app):** the owner's order card is shorter: address and landmark on one line, call
  and map as round buttons beside it; the screenshot thumbnail and «Kattalashtirish» fit the
  money sheet.
- **Added (core, app):** `networkRequestedAt` on an order: «kuryer qidirilmoqda» says for how
  many minutes and what to do if nobody takes it.
- **Changed (app):** the delivery radius says that empty means no limit; a shop color from
  before the swatches shows first and chosen; swatches read their names; each of the courier's
  shops says «Bugun ishlaysiz», «Bugun dam olish» or «Do'kon tasdiqlashini kutmoqda»; checkout
  explains paying once, next to the total; the history row puts the status on its own line;
  the showcase has «Hammasi»; the owner's menu says how many products have no photo.
- **Not done:** the owner's tab bar stays on top: at the bottom it would sit on Telegram's main
  button.

### «Sozlamalar» in parts (UX phase 9, from the fourth critique)
- **Changed (app):** «Sozlamalar» opens on «Buyurtma qabul qilish» and a list of its parts (Do'kon,
  Yetkazib berish, Ish vaqti, Manzil, Kartalar, Kuryerlar, Do'kon imkoniyatlari, Havola, QR-kod va
  vitrina), each with what is set in it now; a missing card or location shows in amber. A tap
  opens the part with «Saqlash»; leaving it with unsaved edits asks first.
- **Fixed (app):** the back press goes only to the innermost screen (a sheet over a screen, a
  part of «Sozlamalar»), never to two of them at once.
- **Changed (app):** the owner's menu says «Sotuvda» / «Sotilmaydi» under each switch, mutes the
  products off sale and keeps long names on two lines; a network courier sees how long an order
  nearby has waited; text buttons are in the shop's color, not link blue; the screenshot
  thumbnail shows the whole picture with «Kattalashtirish».
- **Not done (owner's decision needed):** the delivery fee on the network courier's card: who
  gets it on a network order is not decided yet.

### «Do'konga qo'ng'iroq» (UX phase 8, from the fourth critique)
- **Added (core, worker):** the shop's optional contact phone (`contact_phone`, migration
  `0012`, E.164 through `Phone`), set in the owner's `PATCH /api/owner/shop` and given to
  customers with the shop.
- **Added (app):** «Mijozlar uchun telefon (ixtiyoriy)» in «Sozlamalar» → «Do'kon», checked as
  typed; the customer's order shows «Do'konga qo'ng'iroq» with the number while the transfer is
  awaited or checked, and after «Pul kelmadi» says why to call. Without a number nothing changes.

### Calm when the money is in doubt (UX phase 7, from the fourth critique)
- **Changed (app):** «Pul kelmadi» reads «Do'kon pulni hali ko'rmadi», and the note under the
  card asks to check the transfer and send the screenshot again (it no longer says «O'tkazdim»
  next to «Chekni qayta yuborish»).
- **Changed (app):** while the shop checks money already sent, the customer's cancel waits behind
  «Boshqa amallar»; the owner's «Yo'q, pul kelmadi» asks once before sending the customer back.
- **Changed (app):** the application picks no kind of business for the owner («Faoliyat turini
  tanlang»); checkout says how paying works at the top; the order refreshes when the customer
  comes back from the bank app; the hero only says «Quyidagi kartaga … o'tkazing»; «l» is «litr».

### The money first, no dead buttons (UX phase 6, from the third critique)
- **Changed (app):** while an order is unpaid, the big bottom button is «O'tkazdim» (not «back to
  the catalog»), and the card with «Raqam» and «Summa» copy buttons stands right under the
  status; the receipt sheet says how to take a screenshot.
- **Changed (app):** one word for the act everywhere: «O'tkazma kutilmoqda / tekshirilmoqda»;
  cancelling after «O'tkazdim» says the shop returns the money.
- **Changed (app):** the application and the product editor never show a dead button: a tap
  says what is missing; leaving «Sozlamalar» with unsaved edits asks first.
- **Changed (app):** the owner's «Pul keldi» is quiet for an order without a screenshot; «Pulni
  tekshirish kerak» jumps to the first transfer to check; history rows say «N xil mahsulot».
- **Not done (owner's decision kept):** a way to say «paid» without a screenshot; the screenshot
  stays required.

### Trust at the money moment, a queue for rush hour (UX phase 5, from the second critique)
- **Added (core, worker, app):** «Do'konga eslatish»: when the shop has not answered a transfer
  for 10 minutes, the customer asks the owner again with one tap (the bot repeats «Ha, … keldi» /
  «Yo'q, kelmadi»); at most once per pause (`REMIND_TOO_SOON`), migration
  `0011_transfer_reminder.sql`.
- **Changed (app):** the shop's card says whose it is («Bu karta … do'koniga tegishli»); waiting
  for the transfer shows a card, «Pul kelmadi» a warning instead of the same clock; the order's
  first stage is the money (O'tkazma kutilmoqda → To'lov tekshirilmoqda → To'landi), and lists
  show the payment state of a new order («Tekshiring» for the owner).
- **Changed (app):** the owner's «Buyurtmalar» tab counts active orders; transfers to check come
  first, outlined, under «Pulni tekshirish kerak: N».
- **Fixed (app):** «Ishga tayyor»: «O'zim yetkazaman» sits under «Kuryer» instead of squeezing it
  word by word; toasts appear above the bottom button, never over a banner.
- **Changed (app):** a catalog mostly without photos is a list (photo or section mark, name,
  price, «+»); scrolling chips fade at the edge; the money tab tells how many orders are still in
  progress; the product name has an example; checkout's two Telegram buttons look alike.

### Customer, courier, application and search (UX phase 4)
- **Added (app):** a shop with more than 20 products gets a search over its catalog (Latin or
  Cyrillic, like the showcase), with «Hech narsa topilmadi» and a clear button.
- **Changed (app):** «Buyurtmalarim» wears a dot while an order is on its way; a product without
  a photo shows the first letter of its name on a tint of its section, with the section's mark.
- **Changed (app):** checkout puts «Joylashuvni yuborish» first, labels every field the same way
  and marks the optional ones; the order button is never dead: a tap says what is missing,
  scrolls to it and makes it glow. The bottle question stands over its stepper.
- **Changed (app):** the order shows four stages for the customer (paid, being made, on the way,
  delivered) instead of the shop's six steps; history rows say how many products.
- **Changed (app):** the courier's «nothing to deliver» hides while network orders wait nearby;
  «Pozitsiyalar» is «Mahsulotlar».
- **Changed (app):** the application opens with its three steps listed; the token field has
  «Qo'yish» (paste); a long bot name no longer breaks mid-word; «/newbot» is in quotes.
- **Changed (app):** «Rasmiylashtirish» is «Buyurtma berish»; the showcase's clear button says
  «Qidiruvni tozalash».

### The owner's workplace (UX phase 3)
- **Changed (app):** with orders waiting, «Ishga tayyor» folds into one line («4/6 · Keyingi: …»)
  so the order comes first; a done step keeps its words with a tick, no strike-through.
- **Changed (app):** an order card has one main step; «Kuryer» and «Bekor qilish» are quiet below
  it; «Tuman tarmog'idan kuryer qidirilmoqda» wraps instead of overflowing.
- **Changed (app):** the «Sotuvda» switch acts at once (off for today where the shop keeps a
  stop-list, with a note); «⋯» holds «Faqat bugunga» and «Butunlay yashirish».
- **Added (app):** the product editor picks the category from the name (osh → Taomlar, suv →
  Suv, …) until the owner chooses; four likely categories, the rest behind «Boshqa». The form
  never hides under the bottom button (safe area counted).
- **Changed (app):** «Sozlamalar» opens with chips to each group; «Buyurtma qabul qilish» turned
  off is amber with what it means; seven shop colors that never look alike, in one row.
- **Changed (app):** «Pul» explains «Tushum» (delivered and paid orders) and drops the line that
  repeated it.

### Readable everywhere (UX phase 2)
- **Changed (app):** secondary text, links and the destructive red reach WCAG AA (≥4.5:1) on
  white, gray and tinted surfaces; success and amber marks reach 3:1. Small print is never
  under 13 px.
- **Added (app):** brand-colored words use a shade of the shop's color darkened just enough to
  read (an amber or sky shop color was 3.2:1); a mid-tone shop color gets black text when neither
  white nor dark gray reads on it.
- **Changed (app):** switches, segments, the courier's days, the courier's phone and «Savatni
  tozalash» are 44 px targets with a pressed state; an unavailable button is a calm gray instead
  of a see-through one; «Ishga tayyor» fills with a transform, not a layout change; status words
  are in the text color with a colored mark.
- **Added (e2e):** every main screen is checked for contrast and text size (`support/readability.ts`).

### Money and trust: the transfer screenshot (UX phase 1, owner's decision)
- **Added (core, worker, app):** «O'tkazdim» carries the screenshot of the transfer; without it
  the press is refused (`RECEIPT_REQUIRED`). It is stored privately (never on a public address),
  seen only by the order's customer and the shop's owner, and sent to the owner as a photo with
  the sum and the card tail. Sending again replaces it until the money is confirmed.
- **Added (worker, app):** warnings for the owner: the same screenshot came before (this shop, or
  this customer in any shop), and how many of the customer's transfers were never found.
- **Added (core, worker, app):** «Pul kelmadi»: the order goes back to unpaid, the customer is
  told why and sends the screenshot again (`PAYMENT_NOT_REJECTABLE` once settled).
- **Changed (worker, app):** «Pul keldi» never accepts in one tap: the bot asks «… keldimi?»
  with «✅ Ha, … keldi» (`pc:`) and «Yo'q, kelmadi» (`pn:`); the app opens a sheet with the sum,
  the card, the screenshot and the warnings. If Telegram refuses the picture, the owner still
  gets the text and the buttons.
- **Changed (app):** checkout says how much will be transferred after the order instead of the
  card number; the order screen shows «To'lov kutilmoqda · sum», then «Do'kon pulni
  tekshirmoqda» with the screenshot sent, or «Do'kon pulni topmadi» with «Chekni qayta
  yuborish». The customer's cancel is a quiet link, far from «O'tkazdim».
- **Not done (honest limit):** a fake or AI-made screenshot cannot be told reliably; the money on
  the card stays the only proof.

### Bug hunt across the platform (four independent audits)
- **Fixed (core, worker):** a late network report wrote the whole order back and could undo a
  courier's «Беру» or the owner's cancel; it is now one conditional write, reported once.
- **Fixed (worker):** orders and shops save only over the version they were loaded with: two
  requests at once (a cancel and «Деньги пришли», an approval and an owner's edit) can no longer
  undo each other; the older one gets 409 `STALE`.
- **Fixed (worker):** the CSV export failed past 100 orders (D1's bound-value limit); a
  customer's name or address can no longer run as an Excel formula; a shop name with `&` or `<`
  no longer breaks the report and poster captions; Telegram failures on a request are 502
  `TELEGRAM_FAILED` instead of 500.
- **Fixed (worker):** a deleted owner card no longer silences the courier and the customer; it
  is sent again. A broken contact number no longer makes Telegram resend the update for hours.
  An unset secret or bot token matches nothing. A courier invite is single-use even when two
  people open it at once. Long orders fit Telegram's 4096 characters. Reconnecting a bot keeps
  its update queue. Network offers go to at most 20 couriers (subrequest limit).
- **Added (worker):** the owner hears from Zumda | Business whenever a card is added or the
  payment card changes.
- **Fixed (core):** the owner testing his own shop can press «Men o'tkazdim»; conflicts carry
  their own code (`BOT_TAKEN`, `SLUG_TAKEN`, `COURIER_ALREADY_REVIEWED`, `STALE`).
- **Fixed (app):** a slow answer for a shop left behind no longer empties another shop's cart or
  paints its brand; each business in «Mening bizneslarim» starts clean; the browser sign-in
  button retries after a failed start; an expired browser session returns to sign-in; clear
  texts for every conflict and Telegram failure; no silent failures; the money tab never shows
  the previous period; the order list keeps pages opened with «Yana»; buttons wait for their
  request.

### Onboarding review; Telegram Login in the browser (owner's decisions)
- **Changed (core, worker, app):** the application is three short steps: name and kind → bot →
  where the business is (location and address). The card, hours, products, logo and courier move
  to «Ishga tayyor», the owner's checklist; a shop without a card still takes no orders.
- **Changed (worker):** the shop's bot is connected at the application (webhook, menu button,
  `/start`, descriptions): customers see a pending shop as «Tez orada ochiladi», no orders.
- **Added (core, worker, app):** rejection with a reason (migration `0009`), seen only by the
  owner; «Tuzatib qayta yuborish» (`POST /api/owner/shop/resubmit`) sends it to the admins again.
- **Fixed (worker, app):** Telegram deprecated the old Login Widget («Bot domain invalid» on
  business.zumda.shop). Sign-in uses the new Telegram Login (OpenID Connect): `GET
  /api/business/login` gives the Client ID and a nonce, `POST /api/business/session` checks the
  `id_token` against Telegram's published keys. @BotFather needs Trusted Origin and Redirect URI.

### Bots notify, the Mini App acts (owner's decision)
- **Changed (worker):** every bot has `/start` only; any other message gets one line and the
  button to the app. The admins' `/market`, `/district`, `/network` and `/reconnect` are gone;
  the deploy clears their command list. Shop bots get the `/start`-only list on connecting.
- **Added (core, worker):** «Platforma» API for platform admins (`/api/admin/*`: applications and
  shops with their owners, approve and turn off, «Botni qayta ulash», the showcase deal,
  districts with network stats), `GET /api/platform/me`; migration `0008` (shops by status).
- **Added (worker):** every message carries a button to the Mini App: the order (owner, courier,
  customer; showcase customers too), the application or the shop in «Platforma», «Mening
  bizneslarim».
- **Added (app):** «Platforma» in Zumda | Business (admins only, its own chunk): «Arizalar»,
  «Bizneslar», «Tumanlar»; a message's «Buyurtmani ochish» opens that order first in the owner's
  «Buyurtmalar», or the customer's tracking.

### Goal 14 closed; a managed bot's token is always fresh
- **Fixed (worker):** Telegram may not send `managed_bot` when an owner changes the token in
  @BotFather, so Zumda asks for the current token (`getManagedBotToken`) before it uses a managed
  bot: at the application, the approval and `/reconnect`. If Telegram refuses, the admin gets the
  usual `/reconnect` warning.
- **Docs:** goal 14 closed by the owner with the practice answers; the application and approval
  in production move to the business onboarding review.

### Goal 15: kinds of business, own addresses, Zumda | Business in a browser, bot profiles
- **Changed (core, worker, app):** kinds of business are «Oziq-ovqat do'koni» (`grocery`),
  «Restoran» (`food`), «Xizmat ko'rsatish» (`service`). Water is a grocery store with the bottle
  deposit; migration `0007` moves old `water` rows. Services have their own words («Xizmatlar»,
  «Bajarilmoqda», «Bajarildi») and icons; new categories cleaning, car care, repair, beauty.
- **Added:**
  - own addresses `app.`, `business.`, `delivery.zumda.shop` (one Pages project, the app picks
    its mode by address); `zumda.shop` redirects to `t.me/zumdashop_bot`; CORS for the three
    addresses.
  - Zumda | Business in a browser: Telegram Login Widget, `POST /api/business/session`, a
    30-day session in `Authorization: Bearer`, «Orqaga» and «Chiqish».
  - the deploy sets the three bots' names, descriptions, commands (admins' own),
    menu buttons and avatars (only when changed, hash in D1 `platform_settings`); a welcome
    picture for Zumda | Business.

### Three bots by role: Zumda | Shop, Zumda | Business, Zumda | Kuryer (owner's decision)
- **Added (worker):** the Zumda | Business bot (`BUSINESS_BOT_TOKEN`, webhook `/tg/business`):
  «Mening bizneslarim», applications, the admins' approval buttons and commands, `managed_bot`
  updates; it is the manager of the shops' bots (Managed Bots). Owners' and admins' messages and
  alerts come from it. `X-Bot: business` replaces `X-Via: admin`; `/api/platform/*` accept only
  its signature (`BUSINESS_BOT_ONLY`).
- **Changed:** `@zumdashop_bot` (Zumda | Shop) is for customers only: its welcome and description
  no longer offer to connect a business; approval cards it sent before still work.
- **Added (app):** `?mode=business` opens «Mening bizneslarim» (old `?mode=onboarding` buttons too).
- **Added:** the deploy sets the bots' names «Zumda | Shop», «Zumda | Business», «Zumda | Kuryer»,
  connects Zumda | Business (webhook, menu «Bizneslarim», descriptions); `check-access.sh` checks
  its token and `can_manage_bots`; `brand/zumda-business-avatar.png`.

### Goal 14: «Mening bizneslarim» and a bot without a token
- **Added (core):** `Business.botSource` (`managed` | `token`), `ManagedBotRepository`,
  `ManagedBotChangedUseCase`, `ListMyManagedBotsUseCase`; an application takes a managed bot by
  id (only the owner's own, not taken yet). The owner DTO says `managedBot`.
- **Added (worker):** migration `0006_managed_bots.sql`; `managed_bot` updates in `/tg/platform`
  (the token is fetched and encrypted, the owner hears «Bot yaratildi»; a new token reconnects a
  live shop; a new owner alerts the admins); `POST /api/platform/managed-bot/prepare`,
  `GET /api/platform/managed-bots`; `POST /api/platform/shops` takes `botToken` or
  `managedBotId`; `X-Via: admin` opens the owner's own shop from the Zumda bot (others: 403).
- **Added (app):** «Mening bizneslarim» with statuses and «Yangi biznes»; the wizard is
  business → bot («Bot yaratish» through `WebApp.requestChat`, the t.me/newbot link, «Menda bot
  bor» with a token) → delivery and the card; any business opens its owner section in place.
- **Fixed (app):** leaving a shop opened inside the Zumda bot no longer sends its `X-Shop` with
  the next request.
- **Changed:** the deploy gives the Zumda bot `managed_bot` updates; `scripts/check-access.sh`
  checks `can_manage_bots`.

### Welcome of the Zumda bots: scene "Ko'cha" (owner's choice)
- **Added (worker):** `/start` in the Zumda bot and the courier bot answers with one picture (a
  street of eateries, shops and services with a Zumda courier) and the greeting as its caption,
  with the same buttons; if Telegram cannot take the picture, the same text goes alone
  (`telegram/welcome.ts`, `TelegramGateway.sendPhoto`).
- **Changed:** Zumda speaks of shops, eateries and services: «do'konlar, oshxonalar va
  xizmatlar» in the greeting, the buttons («Qidirish va buyurtma berish», «Biznesimni ulash»)
  and the bots' descriptions.
- **Added:** the deploy sets both bots' descriptions and profile lines from the repository.
- **Added:** `brand/welcome/`: the scene source, 1280×720 pictures and 640×360 Description
  Pictures for @BotFather; `packages/app/public/welcome/` serves the JPEGs.

### Zumda's look: the green house (owner's decisions)
- **Added:** brand kit in `brand/` (mark, logo in outlines, bot and group avatars, README).
- **Changed (core):** a new shop is Zumda green (`#15803d`) until the owner picks a color.
- **Added (worker):** `PUT /api/owner/shop/bot-photo` and `PUT /api/platform/shops/:id/bot-photo`
  set the shop bot's picture (`setMyProfilePhoto`); approval and a new name set its description
  and profile line with «Zumda asosida ishlaydi» (`setMyDescription`, `setMyShortDescription`).
- **Added (app):** the Zumda mark (`ui/zumda-mark.tsx`) in the storefront line, the showcase,
  the courier screen, the showcase badge and the QR poster («Zumda asosida ishlaydi»); the bot
  picture is drawn from the logo or the name with the mark (`lib/bot-avatar.ts`).

### Name: Zumda (owner's decision)
- **Changed:** the product and the company are **Zumda** (company: Zumda Shop); the former name
  LLS is gone from the bots, the app, the QR poster («powered by Zumda»), the docs and the code:
  packages `@zumda/*`, Cloudflare names `zumda-worker`, `zumda`, `zumda-media`, `zumda-app`;
  the GitHub repository keeps the name `imfozilbek/lls`, and the deploy runs for it. Bots:
  `@zumdashop_bot`, `@zumdashop_kuryer_bot`.

### Many cards, Uzbek only, light only (owner's decisions)
- **Added (core):** `PayoutCardBook`: a shop keeps up to 20 cards, chooses the payment card
  customers are shown, switches it any time; the payment card is never removed (`CARD_EXISTS`,
  `PAYOUT_CARD_LIMIT`, `PAYMENT_CARD_IN_USE`). Every order keeps the card it was shown
  (`Payment.card`). Registration adds the first card.
- **Added (worker):** migration `0005_payout_cards.sql` (additive, moves today's card into the
  list); `GET/POST /api/owner/shop/cards`, `PUT …/:id/payment`, `DELETE …/:id`; the message to
  the customer names the card of the order. `PATCH /api/owner/shop` no longer takes a card.
- **Added (app):** «Kartalar» in settings: the list, «To'lov uchun», «Shu kartaga to'lansin»,
  add, delete; the order screen shows the order's card.
- **Changed:** Uzbek (Latin) only in the app, the bots, the CSV and the QR poster; the language
  switch hides itself while there is one language; old `ru` rows and Russian Telegram read as
  Uzbek. The owner guide and the courier memo are Uzbek only.
- **Changed (app):** always light: our own light palette instead of Telegram's theme; Telegram's
  header, background and bottom bar are painted white.
- **Changed (e2e):** Uzbek texts everywhere; many cards; a dark Telegram still shows the light
  app; light screenshots only.

### Transfer only, before cooking (owner's decision)
- **Changed (core):** customers pay only by transfer to the shop's card: every order starts
  unpaid; «Я перевёл» marks it sent; the owner's «Деньги пришли, принять» confirms the money and
  accepts in one step; `pending → accepted` is refused while unpaid (`PAYMENT_REQUIRED`). A shop
  without a card takes no orders (`NO_PAYOUT_CARD`) and is not open; the card is required when a
  shop registers. The money report: placed, delivered, cancelled, goods, delivery, deposits,
  paid by transfer, commission; transfers to check (cancelled ones too) and refunds.
- **Removed (core, worker, app):** cash at the door, «how the customer paid», courier cash on
  hand, handovers to the owner, debts (`PaidWith`, `CashHandover`, `RecordCashHandover`,
  `/owner/couriers/:id/handovers`). The `cash_handovers` table and the `cash_courier_id` column
  stay as history (additive schema).
- **Added (worker):** `POST /api/orders/:id/transfer-sent` (the customer only; the owner is
  pinged once); `PATCH /api/owner/orders/:id/payment` `{ action: "paid" }` accepts as well and
  hands the order to the district network if no own courier is free; the owner's card «💳 Ждём
  перевод» with «💳 Деньги пришли, принять» (`p:<id>`); the customer gets the card and the sum
  after placing; the courier card says «Оплачено заранее: денег с клиента не брать» and has one
  «Доставил»; the CSV has no payment method column.
- **Added (app):** «Оплата переводом» at checkout (the card, copy, the sum); «Я перевёл» and
  «Магазин проверяет перевод» on the order; «Скоро начнёт принимать заказы» for a shop without a
  card; owners: «Деньги пришли, принять» on the order, a banner without a card, the card field
  in onboarding (required) and in settings (never removed from there); «Деньги» without couriers'
  cash and debts; couriers: one «Доставил», no «На руках».
- **Changed (e2e):** the money spec follows the transfer path; a shop without a card; every
  accept is «Деньги пришли, принять»; the demo grocery shop has a card.

### District network (goal 06)
- **Added (core):** `District` (center + radius, waiting time); a shop's district from its
  location; network delivery per shop, on by default; the courier's own network consent; a link
  status `network`; network orders: requested after «Принять» when no own courier is free (or by
  hand), «Беру»: the first wins, one network order at a time, cash goes back to the shop;
  "nobody took it" after 10 minutes; the network's share for the admin. The delivery fee of a
  network order is a snapshot (`deliveryFeeTo`), temporarily the shop's.
- **Added (worker):** migration `0004_district_network.sql` (additive); «Новый заказ рядом»
  with «Беру» in the courier bot, «Уже взяли» for the others, the network offer after the first
  approval; `/district` and `/network` in the Zumda bot; `PUT /api/owner/orders/:id/network`,
  `PUT /api/courier/network`, `GET /api/courier/network/orders`, `POST …/:id/claim`
- **Added (app):** «Беру заказы района» and «Заказы рядом» for couriers; «Сеть района» switch,
  «Доставщик сети района» and the order's network status for owners
- **Added (e2e):** the network spec: two couriers race, cash back to the shop, the switch,
  leaving the network, the 10-minute alert; demo district and two network couriers in the seed

### Zumda courier bot (goal 05)
- **Added (core):** `CourierProfile`: one per person (name, phone, vehicle, shift until
  midnight); a `Courier` is now the person's link to one shop with status pending / active /
  removed, working days and "not today"; an order goes only to a courier who is approved, works
  today and is on shift (`COURIER_NOT_AVAILABLE` with the reason); the courier's home across
  shops with cash per shop
- **Added (worker):** migration `0003_courier_profiles.sql` (additive, moves today's couriers);
  the Zumda courier bot (`/tg/courier`, `COURIER_BOT_TOKEN`): invites, phone, order cards with the
  shop's name and their buttons; owner approval from the shop bot or the app; `X-Bot: courier`
  auth; `/api/courier/home`, `/shift`, `/profile`; owner `PATCH /couriers/:id` and
  `POST /couriers/:id/review`; the deploy connects the courier bot
- **Changed:** courier invites, cards and "Мои доставки" moved from shop bots to the courier bot;
  `/api/courier/orders` and `/api/courier/cash` replaced by `/api/courier/home`
- **Added (app):** the courier screen across shops (shift, orders with the shop's name, cash per
  shop, vehicle); owners approve couriers, set their days and "not today", see who is on shift;
  unavailable couriers are greyed out with the reason
- **Added (e2e):** courier bot scenarios: two shops, approval, days, shift, cash per shop

### Money, hours per day, QR poster
- **Added (core):** `Payment` per order: cash or a transfer to the shop's card; statuses
  unpaid / awaiting / paid / refund due / refunded; the courier says how the customer paid at the
  door (cash, transfer, later = debt); cash a courier holds and handovers to the owner; money
  report by period; `PayoutCard` (16 digits, Luhn). No payment gateways.
- **Added (worker):** migration `0002_money.sql` (additive); `/api/owner/money`, payment
  confirm / refund, courier handovers, `/api/courier/cash`; the CSV report and the QR poster
  are sent to the owner's chat (`sendDocument`); three "Доставил" buttons in the courier's card
- **Added (app):** payment choice at checkout with the shop's card and a copy button; payment
  line on order screens; «Деньги» tab instead of «Статистика»; courier "how paid" and
  «На руках»; payout card, working hours per day and the QR poster in settings
- **Removed:** the stats endpoint and DTO (replaced by the money report)
- **Added (e2e):** 8 money scenarios; the fake Telegram accepts files

### Stack
- **Removed:** `@zumda/api` (NestJS, MongoDB, Redis), `@zumda/bot`, `@zumda/admin`, `deploy/`, `.gitea/`
- **Added:** `@zumda/worker`: Cloudflare Worker (Hono + zod), D1 database, R2 for photos
- **Added:** `@zumda/app`: one Telegram Mini App (React + Vite + Tailwind) for customers,
  owners ("Мой магазин") and shop onboarding
- **Changed:** Bun 1.3, Vitest 4.1, GitHub Actions CI and an idempotent Cloudflare deploy

### @zumda/core
- **Changed:** domain rebuilt for white-label shops: one bot and brand per shop, integer UZS money,
  working hours in UTC+5 (night shifts supported), shared category taxonomy and units
- **Changed:** one status table; the owner moves `pending → … → delivered`, the customer can
  cancel only while `pending`
- **Added:** use cases for shop onboarding and admin review, catalog, orders, stats
- **Security:** prices, totals and the customer are always taken from the server, never the client
- **Removed:** couriers, domain events, analytics charts (stage 3 / unused)

### @zumda/worker
- **Added:** Telegram initData check with the token of the bot that opened the app
- **Added:** AES-GCM encryption of shop bot tokens
- **Added:** shop bot webhook (`/start`, contact, owner status buttons) and platform bot webhook
  (onboarding, approve/reject, automatic webhook and menu button for approved shops)
- **Added:** notifications: new order → owner card with buttons, status change → customer
- **Fixed:** Telegram messages were never sent on workerd ("Illegal invocation" on unbound `fetch`)
- **Fixed:** a failed reply to Telegram no longer returns 500, so Telegram does not resend updates
- **Added:** `bun run seed:dev` and `bun run init-data:dev` for local end-to-end runs

### @zumda/app
- **Added:** storefront with a two-column menu, categories, Uzbek and Russian texts
- **Added:** per-shop cart, checkout with Telegram contact, location and landmark, cash on delivery
- **Added:** order tracking (20 s refresh) and order history with "show more"
- **Added:** owner section: orders with status buttons, menu with photo upload (resized to WebP),
  stats for today and 7 days, shop settings (name, logo, color, delivery, hours, location)
- **Added:** three-step onboarding wizard in the platform bot
- **Added:** light and dark Telegram themes, pressed and focus states, empty states; 96 KB gzip

### Security (public repository)
- **Fixed:** the deploy workflow ran on `workflow_run` for any CI run from a branch named `main`,
  including fork pull requests, and deployed that code with the production secrets. Deploy is
  now a job in CI that runs only for a push to `main` of this repository, after green checks
- **Added:** actions pinned to commits, read-only token, secrets only in the deploy step,
  `production` environment, `scripts/check-secrets.sh` in CI and as a git pre-commit hook,
  Dependabot, `SECURITY.md`, `CODEOWNERS`
- **Changed:** the workers.dev subdomain is random instead of derived from the account id
- **Changed:** CI in about a minute: in a PR `static` (secrets, dashes, format, lint, build) and
  `unit` (every test once, with coverage) run side by side, e2e runs on eight machines in the
  runner's Chrome (`owner.spec.ts` split into `owner-orders` and `owner-shop`), and each e2e spec resets only data, not migrations; a push to `main` only
  deploys (~30 s). The required checks keep their names (`quality-gates`, `e2e`)
- **Changed:** CI runs once per change: `pull_request` for a PR, `push` only for `main` (a push
  to a PR branch ran quality-gates and e2e twice)
- **Changed:** no em dash anywhere (owner's decision): product texts, code and docs use a colon,
  a comma, a period or a hyphen; `scripts/check-dashes.sh` checks it in CI and pre-commit
- **Added:** Claude deploys `main` again with the `deploy` dispatch event (`repository_dispatch`):
  no Actions permission needed; only someone with write access can send it
- **Changed:** production addresses are Zumda's own: `api.zumda.shop` (Worker Custom Domain) and
  `app.zumda.shop` (Pages); the deploy adds them and their DNS records. The Worker has no
  workers.dev address any more, so the Cloudflare account's subdomain never shows

### Local stand and end-to-end checks
- **Added (e2e):** `bun run stand`: local D1 with three demo shops, `wrangler dev`, the Mini App and
  a fake Telegram Bot API; `bun run e2e`: 67 Playwright scenarios for every role (customer,
  showcase customer, owner, courier, new owner, admin, attacker) and every main screen at 360 px in
  light and dark themes. Runs in CI as the `e2e` job; the deploy waits for it
- **Added (worker):** `TELEGRAM_API_BASE` for the local stand only; any address except
  `http://localhost` / `127.0.0.1` is ignored
- **Fixed (app):** bottom sheets (stop-list, courier, cancel reason) opened inside the list row
  under the tabs, so an option could not be tapped; they now open over the screen
- **Fixed (core, worker):** the first visit of a new customer could fail with "something went
  wrong": parallel first requests both tried to create the customer
- **Fixed (worker):** after a quick reassignment the previous courier was not told; a courier who
  joined by invite got order cards in Uzbek whatever their Telegram language
- **Fixed (worker):** the admin's application card showed the raw shop type and the owner's id
  instead of the name; the new owner was answered in Uzbek whatever their Telegram language
- **Fixed (app):** a wrong or not yet approved shop link says "shop not found" instead of
  "not found, refresh the list" with a useless retry
- **Fixed (seed):** `seed:dev` failed on the new tables (`customer_phone_shares`, `alert_log`)

### Pre-launch audit
- **Security (core, worker):** a shop bot's owner holds its token and could sign any Telegram id.
  An identity signed by a shop bot now counts only inside that shop: it never renames the global
  customer, and a customer's phone reaches a shop only after the customer sent it to that shop's
  bot (or ordered from it through the showcase). New table `customer_phone_shares`
- **Security (worker):** a pending shop opens only for its owner; a disabled shop for nobody
- **Security (worker):** rate limits on showcase search (30/min) and shop sign-up (5/min); search
  pages capped at 50 and counted in one scan
- **Security (worker):** photo uploads are capped while reading (1.5 MB), must really be JPEG, PNG
  or WebP, and are served with `X-Content-Type-Options: nosniff`
- **Added (worker):** if a shop bot fails to connect on approval, the admin is told why;
  `/reconnect <slug>` in the Zumda bot retries
- **Added (worker):** alerts to platform admins through the Zumda bot on server errors and failed
  notifications, one per kind per 10 minutes, bot tokens masked
- **Fixed (deploy):** the deploy never makes a new `TOKEN_ENC_KEY` while shops exist; an optional
  saved key (GitHub secret) restores it. The bot is connected only after the Worker answers
  (up to 5 minutes for a new workers.dev address)
- **Docs:** encryption key, backups and restore (`SECURITY.md`); frozen migrations after the first
  production deploy (`CLAUDE.md`); launch checklist fixes

### Zumda showcase
- **Added (core):** `searchText`: one spelling for Latin/Cyrillic Uzbek and Russian; showcase search
  across shops with a marketplace deal; `SetMarketplaceTerms` for platform admins
- **Added (worker):** `X-Via: marketplace`: a shop opened from the showcase is verified with the Zumda
  bot token and its orders get the `marketplace` channel and commission; `/api/showcase/shops`,
  `/api/showcase/products`; the Zumda bot saves contacts, answers `/market <slug> <percent|off>`,
  writes showcase customers about status changes; the owner card shows the commission
- **Added (app):** showcase screen in the Zumda bot (search, categories, shops); a tap opens the shop's
  storefront there; owners see an "Zumda" mark on showcase orders and the deal in settings
- **Changed:** the Zumda bot's menu button opens the showcase; onboarding stays a `/start` button

### Three verticals, own couriers, marketplace-ready data
- **Security (core, worker):** an order is found only inside the shop from `X-Shop`; before, a
  customer or an owner of two shops could reach an order through the wrong bot
- **Added (core):** `Courier` and one-time `CourierInvite` (48 h, only a hash is stored);
  `canActorMove` next to the one status table: owner: every step; courier: only
  `ready → picked_up → delivered` of their own order; customer: cancel while `pending`
- **Added (core):** order `channel` (`shop_bot` / `marketplace`) with a commission snapshot on the
  goods subtotal; always 0 for the shop's own bot. `Business.marketplace` holds the future deal
- **Added (core):** weight items (quantity in grams, selling step), returnable bottles with a
  deposit, stop-list until the next Tashkent midnight, feature defaults per business type
- **Added (worker):** routes for couriers and invites, `/start c_<code>` in the shop bot, courier
  order card with "Picked up / Delivered", ping when the order is ready; bot words by shop type;
  admin card in uz/ru; Yandex Maps links
- **Added (app):** courier screen (`?mode=courier`), couriers in settings (invite, share, remove),
  assign courier and cancel reason on owner orders, stop-list sheet, weight step and returnable
  switch in the product editor, feature switches, bottle deposit, delivery radius
- **Added (app):** "order again" in order history, bottles field in checkout, shop facts
  (delivery price, minimum, today's hours) in the header; menu vs catalog words by shop type
- **Removed:** `tailwind-merge`, unused core docs, dead value-object methods and dictionary keys
- **Changed:** `bun run seed:dev` seeds three demo shops (food, water, grocery) and a courier

## [0.4.0] - 2026-01-24

### Production Readiness Release

This release completes Phase 6 (Production Readiness) with security hardening, error handling, and deployment configurations.

### @zumda/core v0.4.0
- **Improved:** Order status rules with better `calculateProgress()` implementation
- **Improved:** Test coverage for order status transitions

### @zumda/api v0.6.0
- **Security:** CORS restricted to specific origins (no wildcard)
- **Security:** WebSocket CORS configured with specific origin
- **Security:** Helmet security headers registered globally
- **Security:** Rate limiting applied globally with @nestjs/throttler
- **Security:** TelegramAuthGuard on all sensitive endpoints (courier, analytics, business)
- **Added:** Pagination on all list endpoints
- **Added:** MongoDB composite indexes for performance
- **Added:** Swagger/OpenAPI documentation at `/docs`
- **Added:** CreateBusinessDTO with class-validator validation
- **Added:** `.env.example` with all required variables
- **Improved:** NestJS Logger instead of console.error
- **Improved:** ForbiddenException in courier service for proper error handling
- **Improved:** Filter inactive businesses from public list

### @zumda/bot v0.6.0
- **Added:** `.env.example` configuration template
- **Added:** Error screens (404, 500, network error)
- **Added:** Production logger service
- **Added:** Network status detection with `useNetworkStatus` hook
- **Added:** WebSocket auto-reconnection with exponential backoff
- **Added:** Connection status indicator UI component
- **Added:** `useWebSocket` hook for real-time updates
- **Improved:** Pagination handling in API client
- **Improved:** Checkout form disabled during submission

### @zumda/admin v0.5.0
- **Added:** `.env.example` configuration template
- **Added:** Logout functionality in Settings page
- **Added:** Logout navigation in Header
- **Added:** Pagination component
- **Added:** Pagination UI in Orders page
- **Added:** Product image preview in ProductForm
- **Improved:** Pagination handling in API client

### Deployment
- **Added:** PM2 ecosystem configuration
- **Added:** Nginx configuration for reverse proxy
- **Added:** Deployment script and documentation

## [0.3.6] - 2026-01-23

### @zumda/core v0.3.0
- **Added:** Domain events infrastructure (`src/domain/events/`)
- **Added:** `DomainEvent` base class with `eventId`, `occurredOn`, and `eventName`
- **Added:** `OrderCreatedEvent` for order creation notification
- **Added:** `OrderStatusChangedEvent` for status change tracking
- **Added:** `CourierAssignedEvent` for courier assignment notification
- **Added:** `EventDispatcher` singleton with pub/sub pattern and wildcard support
- **Added:** Order status transition rules (`src/domain/rules/order-status-rules.ts`)
- **Added:** `isValidTransition()` and `getValidTransitions()` functions
- **Added:** `calculateProgress()` for order status progress percentage
- **Added:** Business hours validation (`src/domain/rules/business-hours.ts`)
- **Added:** `isBusinessOpen()`, `getDaySchedule()`, `getNextOpenTime()` functions
- **Added:** Order calculator service (`src/domain/services/order-calculator.ts`)
- **Added:** `calculateOrderTotal()` with delivery fee threshold
- **Added:** `calculateDiscount()` and `applyDiscount()` functions
- **Added:** Unit tests for all new modules (83 new tests)
- **Improved:** Total tests now at 271 (was 188)

### @zumda/api v0.4.0
- **Added:** Rate limiting with @nestjs/throttler (`src/middleware/rate-limiter.ts`)
- **Added:** `RateLimiterGuard` with IP extraction from Fastify request
- **Added:** Rate limit presets: general, auth, createOrder
- **Added:** Helmet security headers configuration (`src/middleware/helmet.ts`)
- **Added:** Input sanitization utilities (`src/middleware/sanitize.ts`)
- **Added:** `sanitizeString()`, `sanitizeObject()` functions
- **Added:** `hasSqlInjection()`, `hasNoSqlInjection()` detection
- **Added:** Session management service (`src/auth/session.ts`)
- **Added:** Redis-backed session storage with TTL
- **Added:** Role-based access control (`src/auth/rbac.ts`)
- **Added:** `Role`, `Resource`, `Action` enums
- **Added:** `RolesGuard` with permission checking
- **Dependencies:** Added @nestjs/throttler, @fastify/helmet

### @zumda/bot v0.4.0 (via @zumda/api)
- **Added:** Telegram notification service (`src/notifications/telegram-notification.service.ts`)
- **Added:** `sendOrderConfirmation()` - order placed notification
- **Added:** `sendStatusChangeNotification()` - order status updates
- **Added:** `sendCourierAssignedNotification()` - courier assignment
- **Added:** `sendDeliveryCompleteNotification()` - delivery complete
- **Added:** `sendNewOrderNotification()` - new order for business
- **Added:** `sendNewOrderAvailableNotification()` - new order for couriers
- **Added:** `OrderService` integration with notification service
- **Added:** `CourierService` integration with notification service
- **Added:** Russian language message templates

## [0.3.5] - 2026-01-23

### @zumda/api
- **Added:** WebSocket gateway for real-time events (`packages/api/src/gateway/`)
- **Added:** `EventsGateway` with room-based event broadcasting
- **Added:** WebSocket events: `order_created`, `order_status_changed`, `order_cancelled`, `courier_assigned`, `new_order_available`
- **Added:** Socket.io integration with NestJS
- **Changed:** `OrderService` now emits WebSocket events on order creation, status updates, and cancellation
- **Changed:** `CourierService` now emits WebSocket events when courier takes or completes an order

### @zumda/bot
- **Added:** WebSocket client for real-time updates (`src/lib/websocket.ts`)
- **Added:** `useOrderUpdates` hook for real-time order status tracking
- **Added:** `useNewOrders` hook for courier new order notifications
- **Added:** Real-time order updates on `OrderTracking` screen
- **Added:** Real-time new order notifications on `AvailableOrders` screen
- **Added:** Haptic feedback on new order notifications
- **Added:** Toast notifications for order status changes and courier assignments

## [0.3.4] - 2026-01-22

### @zumda/bot
- **Added:** Toast notification system with success/error/warning/info variants
- **Added:** ErrorBoundary component for graceful error handling
- **Added:** SearchInput component for filtering content
- **Added:** Search functionality on Home screen (businesses)
- **Added:** Search functionality on Business screen (products)
- **Added:** Toast notifications for cart actions, order creation, courier actions
- **Improved:** User feedback for all critical actions

### @zumda/admin
- **Added:** Toast notification system with title/message support
- **Added:** Toast notifications for product CRUD operations
- **Added:** Toast notifications for order status changes
- **Added:** Toast notifications for login success/error
- **Improved:** User feedback for all admin actions

## [0.3.3] - 2026-01-22

### @zumda/api
- **Added:** BusinessAuthGuard for protecting business-specific endpoints
- **Added:** BusinessAuthMode decorator for specifying auth mode (business/product/order)
- **Added:** Input validation DTOs: CreateProductDto, UpdateProductDto, CreateOrderDto, UpdateOrderStatusDto, UpdateCustomerDto
- **Added:** BusinessAuthGuard unit tests (10 tests)
- **Security:** Business endpoints now protected - users can only modify their own business resources
- **Improved:** Test coverage now at 47 tests (was 37)

## [0.3.2] - 2026-01-22

### @zumda/core
- **Added:** Analytics use case tests (GetBusinessAnalyticsUseCase, GetSalesChartUseCase, GetTopProductsUseCase)
- **Added:** Date range utility tests (getDateRangeForPeriod, parseDateRange)
- **Improved:** Test coverage now at 188 tests (was 166)

### @zumda/api
- **Added:** Analytics controller tests (getDashboard, getSales, getTopProducts)
- **Improved:** Test coverage now at 37 tests (was 32)

## [0.3.1] - 2026-01-22

### @zumda/core
- **Added:** GetCustomerByTelegramIdUseCase for authenticated customer endpoints
- **Added:** GetCourierByTelegramIdUseCase for authenticated courier endpoints
- **Added:** EntityNotFoundError.customerByTelegramId() factory method
- **Added:** EntityNotFoundError.courierByTelegramId() factory method
- **Added:** Unit tests for GetCustomerByTelegramIdUseCase
- **Added:** Unit tests for GetCourierByTelegramIdUseCase

### @zumda/api
- **Added:** GET /customers/me endpoint with Telegram auth
- **Added:** PATCH /customers/me endpoint with Telegram auth
- **Added:** GET /orders/my endpoint for customer's orders with Telegram auth
- **Added:** GET /couriers/my-orders endpoint with Telegram auth
- **Fixed:** POST /orders/:orderId/take now uses Telegram auth instead of throwing error
- **Security:** TelegramAuthGuard now validates HMAC-SHA256 signature of initData

### @zumda/bot
- **Changed:** orderApi now uses getMyOrders() instead of getByCustomer()
- **Changed:** customerApi now uses getMe() and updateMe() methods
- **Changed:** courierApi now uses takeOrder(orderId) without courierId parameter
- **Changed:** courierApi now uses getMyOrders() instead of getOrders()
- **Removed:** Unnecessary courierId state from courier store

### @zumda/admin
- **Fixed:** productApi.create now uses correct /businesses/:businessId/products path
- **Fixed:** productApi.toggleAvailability now uses PATCH instead of POST

## [0.3.0] - 2026-01-22

### @zumda/core
- **Added:** GetBusinessByTelegramIdUseCase for authenticating businesses by Telegram ID
- **Added:** EntityNotFoundError.businessByTelegramId() factory method
- **Added:** Unit tests for GetBusinessByTelegramIdUseCase

### @zumda/api
- **Added:** TelegramAuthService with HMAC-SHA256 signature validation
- **Added:** POST /api/v1/businesses/auth/telegram endpoint for OAuth
- **Added:** GET /api/v1/businesses/telegram/:telegramId endpoint
- **Added:** TelegramLoginDto with class-validator decorators
- **Changed:** TELEGRAM_BOT_TOKEN is now required (was optional)
- **Added:** Unit tests for TelegramAuthService

### @zumda/admin
- **Added:** TelegramLoginButton component with Telegram Login Widget
- **Changed:** Login page now uses Telegram OAuth instead of manual ID entry
- **Added:** businessApi.authenticateWithTelegram() API method
- **Changed:** Auth store uses loginWithTelegram() with signature validation

## [0.2.0] - 2026-01-22

### @zumda/core
- **Added:** Analytics DTOs: BusinessStatsDTO, DailySalesDTO, SalesChartDTO, TopProductDTO, OrderStatusBreakdownDTO, AnalyticsDashboardDTO
- **Added:** Analytics repository port interface
- **Added:** Analytics use cases: GetBusinessAnalyticsUseCase, GetSalesChartUseCase, GetTopProductsUseCase
- **Added:** Date range utilities for analytics periods (day, week, month)
- **Added:** Comprehensive unit tests - 157 tests covering all domain logic

### @zumda/api
- **Added:** NestJS REST API with Fastify adapter
- **Added:** MongoDB repositories for all entities
- **Added:** Redis caching module
- **Added:** Telegram authentication guard
- **Added:** Domain exception filters
- **Added:** Analytics endpoints: GET /api/v1/analytics/business/:businessId
- **Added:** Controller unit tests - 24 tests covering all endpoints

### @zumda/bot
- **Added:** Telegram Mini App for customers and couriers
- **Added:** Customer screens: Home, Business, Cart, Checkout, Orders, OrderTracking
- **Added:** Courier screens: AvailableOrders, ActiveDelivery, DeliveryHistory
- **Added:** Zustand stores for state management
- **Added:** API client with TypeScript types

### @zumda/admin
- **Added:** React admin panel for businesses
- **Added:** Dashboard with analytics charts
- **Added:** Products management (CRUD)
- **Added:** Orders management with status updates
- **Added:** Settings page

## [0.1.1] - 2026-01-12

### @zumda/core
- **Added:** Unit tests for use cases: update-business, complete-delivery, get-available-orders, get-courier-orders, get-or-create-customer, update-customer
- **Added:** Additional tests for order use cases: cancel-order, get-business-orders, get-customer-orders, get-order, update-order-status
- **Added:** Product use case tests: create-product, list-products, update-product, delete-product, toggle-availability
- **Fixed:** Mock repository interfaces to match actual port definitions

## [0.1.0] - 2026-01-12

### Initial Release

#### @zumda/core
- Domain entities: Business, Product, Customer, Courier, Order, OrderItem
- Value objects: Money, Address, Phone, TelegramId
- Enums: OrderStatus, BusinessType
- Domain errors: EntityNotFoundError, InvalidOrderTransitionError, ValidationError, BusinessRuleViolationError
- DTOs for all entities
- Repository port interfaces
- 20 use cases for business operations
- Unit tests for entities, value objects, and errors
