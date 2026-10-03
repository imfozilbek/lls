# Zumda Roadmap

Zumda: a white-label delivery platform for small businesses in the regions
and districts of Uzbekistan, where aggregators are absent or take 20–30% of each order.
Each shop gets its own Telegram bot and brand; the app says "powered by Zumda".

**Goal:** every offline point within 20–30 km of one district becomes an online point. Start with
the three pilots (Guliston); next to them grow the district's own delivery network; then one Zumda
marketplace on top of both.

> Rules, stack and architecture: `CLAUDE.md`. Product context for design: `PRODUCT.md`.
> Technical debt: `TODO.md`. Owner's launch steps: `docs/launch-checklist.md`.
> Questions for the pilots' meeting: `docs/pilot-meeting.md`.
> The path to the full vision, goal by goal: `docs/goals/README.md` («Дай, друг, дай следующую цель»).

## Current status: stage 1, online point, courier bot, district network and transfer-only payments done; waiting for Cloudflare accounts and the pilots' meeting

| Part | Status | Notes |
|------|--------|-------|
| `@zumda/core` | ✅ Done | Domain + use cases, couriers, channel + commission, weight, bottles, stop-list, showcase search, district network, transfer-only payments, many cards; 195 tests |
| `@zumda/worker` | ✅ Done | Hono API, D1, R2, initData auth (shop bot or Zumda bot), roles, bot webhooks, `/market`, `/reconnect`, `/district`, alerts, money routes («O'tkazdim», «Pul keldi, qabul qilish»), cards, CSV and poster files; Uzbek texts; 87 tests |
| `@zumda/app` | ✅ Done | Storefront, checkout, tracking, reorder, owner section, courier screen, Zumda showcase, onboarding, «Pul», cards, QR poster; Uzbek, light only; 43 tests; 86 KB gzip JS |
| CI | ✅ Done | format, lint, build, test, coverage, 84 e2e scenarios on every push |
| Stand | ✅ Done | `bun run stand` / `bun run e2e`: the whole system locally with a fake Telegram (`docs/e2e.md`) |
| Deploy | 🟡 Ready | Deploy job in `ci.yml` waits for GitHub secrets (`docs/launch-checklist.md`); public-repo hardening in `SECURITY.md` |
| Pilot (food, water, grocery) | ⏳ Next | Three friends' shops, each with its own bot and couriers |

**Blocking:** Cloudflare account, API token and the Zumda platform bot, owner tasks in
`docs/launch-checklist.md`.

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

### M4g. Transfer only, before cooking ✅ (owner's decision, October 2026)
- [x] Customers pay only by transfer to the shop's card; the card shows at checkout and in the bot
- [x] «Я перевёл» → the owner hears it → «Деньги пришли, принять» (paid and accepted in one tap);
      an unpaid order is never accepted
- [x] No cash: one «Доставил» for couriers and owners, no courier cash, no handovers, no debts
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

### M5. Deploy and pilot ⏳
- [x] Idempotent deploy workflow (D1, R2, Pages, secrets, migrations, platform bot)
- [x] `scripts/check-access.sh`: checks the Cloudflare token, account, zone, R2, D1, Pages,
      Workers and both bots, never printing a key
- [x] Owner: R2, Cloudflare token, bot tokens → Claude's environment variables and GitHub
      `production` secrets; Actions settings, secret scanning, `main` ruleset
      (`docs/launch-checklist.md`, steps 2–6)
- [x] Access checked (`scripts/check-access.sh` all OK); SSL Full (strict) and Always HTTPS on
- [x] First production deploy; Claude deploys `main` again with the `deploy` event
- [ ] Production check: connect a test shop → order → statuses → notifications
- [ ] Three friends (food, water, grocery) connect their shops, fill catalogs, invite couriers
- [ ] **First real order**

### M6. District delivery 🔨 (stage 1; goal 05: the courier bot; goal 06: the network)
- [x] Zumda courier bot; one courier profile per person (name, phone, vehicle)
- [x] Invite from "Мой магазин" → accept in the courier bot → the business approves
- [x] The business switches a courier on or off by day; the courier marks "on shift"
- [x] Every connected courier is offered to join the district network
- [x] An order of a point without its own courier on shift goes to free network couriers; the
      first who accepts takes it; the customer paid that point's card before cooking
- [x] Districts set by the admin (`/district`), `/network` report, "nobody took it" alerts
- [x] Orders from several points in one place; each point sees only its own
- [x] Today's shop couriers move to the new model without losing data
- [ ] Decide (owner): who gets the delivery fee for a network delivery, and Zumda's share
      (temporary rule in code: the shop keeps it, Zumda takes none)

### M7. Online point in an hour ⏳
- [ ] Pickup: order ahead, collect without a queue
- [ ] We fill the catalog for the point (import from Excel or photos: when a point asks)

### M8. Service fee ⏳
- [ ] Decide (owner): the fee base (goods, or goods + delivery; deposits never count) and the pilots' rate
- [ ] Rate per business: `/fee <slug> <percent>` in the Zumda bot (0 allowed)
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
