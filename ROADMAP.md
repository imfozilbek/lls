# Zumda Roadmap

Zumda: a white-label delivery platform for small businesses in the regions
and districts of Uzbekistan, where aggregators are absent or take 20–30% of each order.
Each shop gets its own Telegram bot and brand; the app says "powered by Zumda".

**Goal:** every offline point within 20–30 km of one district becomes an online point. Start with
the three pilots (pilot district: Yakkabog', Qashqadaryo); next to them grow the district's own delivery network; then one Zumda
marketplace on top of both.

> Rules, stack and architecture: `CLAUDE.md`. Product context for design: `PRODUCT.md`.
> Technical debt: `TODO.md`. Owner's launch steps: `docs/launch-checklist.md`.
> Questions for the pilots' meeting: `docs/pilot-meeting.md`.
> The path to the full vision, goal by goal: `docs/goals/README.md` («Дай, друг, дай следующую цель»).

## Current status: stage 1 live in production (5 businesses, first orders delivered); waiting for the pilots' meeting and the owner's money decisions

| Part | Status | Notes |
|------|--------|-------|
| `@zumda/core` | ✅ Done | Domain + use cases, couriers, channel + commission, weight, bottles, stop-list, showcase search, district network, card transfer and cash (the shop's choice), many cards, trips, owner chat state; 242 tests |
| `@zumda/worker` | ✅ Done | Hono API, D1, R2, initData auth, roles, three Zumda bots + shop bots (`/start` only), «Platforma» admin API, alerts, money routes, cards, CSV and poster, own map (`/map/*`), trips (OpenRouteService), owner messages through Zumda \| Business until Start; Uzbek texts; 180 tests |
| `@zumda/app` | ✅ Done | Storefront, checkout, tracking, owner section, courier screen, showcase, onboarding, «Mening bizneslarim», «Platforma», business.zumda.shop in a browser, «Pul», cash, map, trips, sound, poster download; Uzbek, light only; 84 tests; ~95 KB gzip initial JS |
| CI | ✅ Done | format, lint, build, unit tests, coverage, 119 e2e scenarios on eight machines on every pull request; a push to `main` deploys |
| Stand | ✅ Done | `bun run stand` / `bun run e2e`: the whole system locally with a fake Telegram (`docs/e2e.md`) |
| Deploy | ✅ Live | `api.`, `app.`, `business.`, `delivery.zumda.shop`, `media.` and `map.zumda.shop` (R2); migrations up to `0018`; the map of Uzbekistan in R2; fits the free plan (`docs/capacity.md`) |
| Pilot (food, water, grocery) | 🔨 Started | 5 businesses in production (all bots made with «Bot yaratish»), 3 active couriers, 4 orders delivered and paid (one through the showcase); no district yet |

**Blocking:** the meeting with the pilots and the owner's decisions below (goal 02). Owner tasks
without code: the «Yakkabog'» district in «Platforma → Tumanlar», the Login Widget and
Description Pictures in @BotFather (goal 15), a local `wrangler d1 export`, the right Zone >
Cache Rules: Edit for the deploy's Cloudflare token (the map kept at the edge, `TODO.md` #25).

**Owner decisions still open** (never invent them in code or docs):
- service fee rate and base (goods, or goods + delivery), the pilots' rate;
- who gets the delivery fee for a network delivery, and Zumda's share;
- subscription price and trial period;
- delivery supplies: range and prices.

---

## Stages

| Stage | What | Revenue | Status |
|-------|------|---------|--------|
| **1. Online point + district delivery** | **Online point:** storefront, orders, money, own couriers, Zumda showcase. **District delivery** (standalone from the first versions): Zumda courier bot, a courier for several points, points without couriers served by the network | Service fee on every order (paid by the customer) + subscription + commission on showcase orders + delivery supplies. Delivery: **not decided** (owner decides) | 🔨 Now |
| 2. District marketplace | One cart from several shops, district filter | Commission on marketplace sales + subscription | Later |
| 3. Delivery at scale | Several pickups per trip, routes | Delivery fee + volume terms | Later |

**District metrics:** points online, active couriers, share of orders delivered by network couriers.

**Financial model:** Zumda earns on volume, from four sources:
- **Service fee:** paid by the customer on every order through Zumda; ≈ turnover through Zumda ×
  average fee rate. The shop's prices never change. Showcase orders also carry the showcase
  commission (paid by the shop).
- **Subscription:** a monthly fee for a shop's own bot; ≈ shops × price.
- **Delivery supplies:** Zumda-branded packaging, bags and disposable dishes sold to businesses.
  Every bag that reaches a customer also advertises Zumda.
- **District delivery:** not decided.

Pilot: **food, water and grocery at the same time.**

---

## Stage 1 milestones

### M0. Foundation ✅
- [x] Bun 1.3 workspaces, Vitest 4.1, ESLint + Prettier
- [x] Old NestJS/MongoDB packages removed (kept at tag `legacy-v0`)
- [x] GitHub Actions CI with quality gates

### M1. Core ✅
- [x] White-label `Business` (slug, bot, brand, delivery, working hours in UTC+5, features)
- [x] Integer UZS `Money`, `Phone`, `Location`, `Slug`, `WorkingHours` value objects
- [x] One order status table: `pending → accepted → preparing → ready → picked_up → delivered`
- [x] Use cases: register/review shop, catalog CRUD, place/cancel/advance order, stats
- [x] Prices, totals and customer always computed on the server

### M2. Worker API + D1 ✅
- [x] D1 schema with indexes for every filter
- [x] initData check with the token of the bot that opened the app (`X-Shop`)
- [x] Bot tokens encrypted with AES-GCM
- [x] Routes: customer, owner, platform onboarding, images from R2
- [x] Error format `{ error: { code, message } }` with rule codes

### M3. Bots ✅
- [x] Shop bot: `/start`, phone via contact, owner buttons for the next status
- [x] Platform bot: onboarding, admin approve/reject, auto webhook + menu button
- [x] Notifications: new order → owner, status change → customer
- [x] Webhooks answer 200 even when a reply fails (no endless Telegram retries)

### M4. Mini App ✅
- [x] Storefront: two-column menu, categories, brand color and logo (Uzbek only since M4h)
- [x] Cart per shop, checkout with Telegram contact, location and landmark
- [x] Order tracking and history
- [x] "Мой магазин": orders with status buttons, menu with photos, stats, settings
- [x] Onboarding wizard in the platform bot
- [x] ~~Light and dark Telegram themes~~ light only since M4h; bundle within 100 KB gzip
- [x] Local end-to-end run on the real Worker (`bun run seed:dev`)

### M4b. Three verticals and own couriers ✅
- [x] Fixed: an order could be read or moved through another shop's bot
- [x] Couriers per shop: one-time invite link in the shop bot, owner assigns, courier moves
      `ready → picked_up → delivered` from the bot card or the courier screen
- [x] Order channel (`shop_bot` / `marketplace`) and commission snapshot; 0 for the shop bot
- [x] Water: returnable bottles with a deposit, "order again"
- [x] Grocery: weight items in grams with a selling step, stop-list until midnight (Tashkent)
- [x] Feature switches per shop; defaults by type; bot and app words by type (menu vs catalog)
- [x] `bun run seed:dev` seeds three demo shops; end-to-end run of all three passes

### M4c. Zumda showcase ✅
- [x] Zumda bot: "Shops and products" button and menu button open the showcase (`?mode=market`)
- [x] One search across showcase shops: Latin or Cyrillic, any apostrophe, word starts; categories
- [x] A tap opens the shop inside the Zumda bot; orders get the `marketplace` channel and commission
- [x] Channel fixed by the bot that signed the request; owner/courier screens never open this way
- [x] Zumda bot saves phones (contact) and writes showcase customers about their orders
- [x] Admin command `/market <slug> <percent|off>`; the owner is told; owner sees the Zumda mark

### M4d. Pre-launch audit ✅
- [x] Shop-signed identities count only inside their shop; phones reach a shop only after they were sent to it
- [x] Pending shops open only for the owner; `/reconnect` when a shop bot fails to connect
- [x] Rate limits on showcase search and sign-up; upload checks; alerts to admins
- [x] Deploy keeps the encryption key; waits for the Worker before connecting the bot
- [x] Backups, restore, frozen migrations documented

### M4e. Local stand and end-to-end checks ✅
- [x] `bun run stand`: local D1, Worker, Mini App, fake Telegram Bot API
- [x] 67 browser scenarios (75 with money) for every role and screen, 360 px (`docs/e2e.md`)
- [x] `e2e` job in CI; the deploy waits for it
- [x] Fixed what the run found: bottom sheets, first visit race, courier notices and language,
      admin card, "shop not found"

### M4f. Money, hours per day, QR poster ✅
- [x] ~~Cash or transfer to the shop's card; cash on the courier's hands; debts~~: replaced by
      M4g (owner's decision)
- [x] «Деньги»: revenue split, transfers to confirm, refunds, CSV report
- [x] Working hours per day; QR poster as a PNG in the owner's chat
- [ ] After the meeting with the pilots: service type (carpets, car wash), variants and add-ons,
      pickup and order time, water subscriptions, staff, expenses: only what they confirm

### M4g. Transfer only, before cooking ✅ (owner's decision, October 2026; cash came back in M4k)
- [x] Customers pay only by transfer to the shop's card; the card shows at checkout and in the bot
- [x] «Я перевёл» → the owner hears it → «Деньги пришли, принять» (paid and accepted in one tap);
      an unpaid order is never accepted
- [x] ~~No cash: one «Доставил» for couriers and owners, no courier cash, no handovers, no debts~~:
      cash came back as the shop's choice in M4k (owner's decision)
- [x] The card is a required onboarding step; a shop without it takes no orders («Скоро начнёт
      принимать заказы», a banner in "Мой магазин")
- [x] Cancelled after the money came: owed back until «Вернул»

### M4h. Many cards, Uzbek only, light only ✅ (owner's decisions, October 2026)
- [x] A shop keeps up to 20 cards and chooses the payment card customers see; switches it any
      time; every order keeps the card it was shown; the payment card is never removed
- [x] Uzbek (Latin) only in the app, the bots and the owner and courier guides; the dictionary
      mechanism stays for another language
- [x] The Mini App is always light; Telegram's frame is painted white

### M4i. Name: Zumda ✅ (owner's decision, October 2026)
- [x] Zumda everywhere: bots, app, QR poster, packages `@zumda/*`, Cloudflare names, docs
- [x] Domain `zumda.shop` bought; bots `@zumdashop_bot` and `@zumdashop_kuryer_bot` created
- [x] The GitHub repository keeps the name `imfozilbek/lls` (owner's decision); the deploy runs for it
- [x] Look: green house mark (scheme "Bog'"), brand kit in `brand/`, the mark in the storefront
      line, showcase, courier screen and QR poster; a new shop is green
- [x] Zumda sets the shop bot's picture (logo or name + the mark) and description
- [x] Bot pictures `brand/zumda-bot-avatar.png` and `zumda-kuryer-avatar.png` set through the Bot API
- [x] Own addresses `app.zumda.shop` / `api.zumda.shop`; the Worker has no workers.dev address
- [x] Bots' `/start` welcome with the street picture; Description Pictures set in @BotFather

### M4j. Bots notify, the Mini App acts ✅ (owner's decision, October 2026)
- [x] Every bot has `/start` only; any other text gets the button to the app
- [x] Every message opens the app on what it is about (an order, «Platforma», «Mening bizneslarim»)
- [x] «Platforma» for admins in Zumda | Business: applications, shops (showcase deal, «Botni qayta
      ulash», off and on), districts with network stats; `/market`, `/district`, `/network`,
      `/reconnect` removed

### M4k. Cash: the shop's choice ✅ (owner's decision, October 2026)
- [x] «To'lov»: card transfer (default), cash or both; the customer picks at checkout
- [x] Cash is accepted at once, goes only with the shop's own courier or the owner, never to the
      network; «Pulni oldim, yetkazdim»; the owner takes it per order in «Kuryerlardagi naqd pul»

### M4l. Native feel and the Zumda sound ✅ (owner's decisions, October 2026)
- [x] Pull to refresh, swipe back, no flashing, data kept on refresh, JS budget kept
- [x] «Zum-da» rings on news for the shop and the courier (softly for the customer); can be off

### M4m. Zumda's own map and trips ✅ (owner's decisions, October 2026)
- [x] OpenStreetMap of Uzbekistan in our R2, served by the Worker; picking and showing places in
      checkout, the application, settings, districts, the courier's and customer's order
- [x] Trips: several orders one way, Zumda's order of the stops, one courier, road route
      (OpenRouteService, optional key), «Yandex Navigatorda ochish»

### M4n. The owner always hears ✅ (October 2026)
- [x] A shop bot the owner never started cannot write first: orders, files and the poster come
      through Zumda | Business with the note to press Start; «Botingizni oching» in «Ishga
      tayyor»; «Platforma» marks such shops
- [x] The QR poster downloads in the app («Yuklab olish») and in a browser

### M4r. Any product in a minute: the Zumda catalog ⏳ (goal 17)
- [ ] Owner's decisions 1-5 of goal 17
- [ ] Catalog search, grams and new units, variants and add-ons, list add (DoD in goal 17)

### M4q. A Zumda Shop QR on the poster ✅ (owner's decisions, October 2026; goal 16)
- [x] «Zumda Shop uchun» QR (`startapp=m_<slug>`) opens the shop inside Zumda Shop; showcase
      money; a shop that left the showcase sends the person to its own bot
- [x] On production: a phone scan of one of the two businesses' QR; posters sent

### M4p. Mini App crashes are seen ✅ (owner's decision, October 2026: logs and errors first)
- [x] Uncaught errors and rejections in the Mini App reach the server log (`client_error`) and
      the admins' alert; nothing about the person (no digits, no other alphabets, no identity)
- [x] At most one request per kind of crash a session (5 at most), no CORS preflight

### M4o. Zumda in Cloudflare's free plan ✅ (owner's decision, October 2026: no paid plans)
- [x] The audit's 14 findings fixed or in `TODO.md` with the reason (#21 to #25)
- [x] D1: a courier's screen, open trips, the network's waiting orders, «Pul», the owner's and
      the customer's order lists and the screenshot check read index ranges, never the history;
      no `COUNT(*)` of a history; a save writes only changed columns; the showcase search by a
      word table (migrations `0016` to `0018`)
- [x] Worker: one query to sign in, cached bot tokens, batched network offers, services only for
      `/api` and `/tg`, 20% of logs; the owner polls a version (20 s), the customer 30 s, the
      courier 45 s; search from 3 letters after 500 ms
- [x] R2: transfer screenshots in their own private bucket, deleted after 30 days; photos and the
      map from `media.` and `map.zumda.shop` (no Worker request); the map upload keeps two maps
- [x] `docs/capacity.md`: the day of 1 000 people, 300 orders, 10 shops, 15 couriers, line by
      line; `test/capacity.test.ts` measures rows read and written on six months of history
- [ ] One day after the deploy: compare Cloudflare's analytics with `docs/capacity.md`

### M5. Deploy and pilot 🔨
- [x] Idempotent deploy workflow (D1, R2, Pages, secrets, migrations, platform bot)
- [x] `scripts/check-access.sh`: checks the Cloudflare token, account, zone, R2, D1, Pages,
      Workers and both bots, never printing a key
- [x] Owner: R2, Cloudflare token, bot tokens → Claude's environment variables and GitHub
      `production` secrets; Actions settings, secret scanning, `main` ruleset
      (`docs/launch-checklist.md`, steps 2–6)
- [x] Access checked (`scripts/check-access.sh` all OK); SSL Full (strict) and Always HTTPS on
- [x] First production deploy; Claude deploys `main` again with the `deploy` event
- [x] Goal 14: «Mening bizneslarim» and a shop bot created from the Zumda bot without a token
      (Telegram Managed Bots); the token path stays
- [x] Three Zumda bots by role: «Zumda | Shop» (customers), «Zumda | Business» (owners, admins,
      Managed Bots), «Zumda | Kuryer» (couriers)
- [x] Goal 15: kinds of business (grocery store, restaurant, service), own addresses (app.,
      business., delivery.zumda.shop; zumda.shop leads to the bot), Zumda | Business in a
      browser, the bots' profiles set by CI
- [x] Goal 14 closed (owner's decision): a bot created in production with «Bot yaratish» in
      Zumda | Business; the application and approval move to the business onboarding review
- [x] Onboarding review (owner's decisions): a three-step application, the bot works before
      approval, «Ishga tayyor» checklist, rejection with a reason and a resubmit
- [x] Zumda | Business in a browser signs in with the new Telegram Login (OpenID Connect)
- [x] Production check: connect a shop → order → transfer → statuses → courier → delivered, also
      through the showcase (production data, 4 October 2026)
- [ ] Three friends (food, water, grocery) connect their shops, fill catalogs, invite couriers
- [ ] **First real order**

### M6. District delivery 🔨 (stage 1; goal 05: the courier bot; goal 06: the network)
- [x] Zumda courier bot; one courier profile per person (name, phone, vehicle)
- [x] Invite from "Мой магазин" → accept in the courier bot → the business approves
- [x] The business switches a courier on or off by day; the courier marks "on shift"
- [x] Every connected courier is offered to join the district network
- [x] An order of a point without its own courier on shift goes to free network couriers; the
      first who accepts takes it; the customer paid that point's card before cooking
- [x] Districts set by the admin («Platforma → Tumanlar»), network stats, "nobody took it"
      alerts (production has no district yet: an owner task)
- [x] Orders from several points in one place; each point sees only its own
- [x] Today's shop couriers move to the new model without losing data
- [ ] Decide (owner): who gets the delivery fee for a network delivery, and Zumda's share
      (temporary rule in code: the shop keeps it, Zumda takes none)

### M7. Online point in an hour ⏳
- [ ] Pickup: order ahead, collect without a queue
- [ ] We fill the catalog for the point (import from Excel or photos: when a point asks)

### M8. Service fee ⏳
- [ ] Decide (owner): the fee base (goods, or goods + delivery; deposits never count) and the pilots' rate
- [ ] Rate per business in «Platforma» (0 allowed)
- [ ] "Сервис" line in the cart, checkout, order screen and bot messages; snapshot in every order
- [ ] The fee in «Деньги» and the CSV
- [ ] Monthly per-shop report "to pay Zumda" (fees + showcase commission); admin report for all shops
- [ ] Shop balance with Zumda: charged, received, owed; the admin marks "Received from the shop" in
      the Zumda bot
- [ ] At the start of a month the bot reminds the shop: the sum and Zumda's card number
- [ ] A shop that does not pay for too long: the admin pauses it and its bot stops taking orders

### M9. Subscription ⏳
- [ ] Decide (owner): price and trial period
- [ ] Paid-until date on the shop card for the admin; reminder before it ends
- [ ] Not paid: pause the shop, as in M8

### M10. Zumda delivery supplies ⏳ (when the first supplies are in stock)
- [ ] Decide (owner): range (packaging, bags, disposable dishes, all with the Zumda brand) and prices
- [ ] Catalog of Zumda supplies in "Мой магазин"; the shop orders, the order comes to Zumda
- [ ] Delivered by the district delivery; paid by transfer to Zumda's card

---

## After the pilot (only when a real client asks)

- Custom domain
