# LLS Roadmap

LLS (LocalLoopSolutions): a white-label delivery platform for small businesses in the regions
and districts of Uzbekistan, where aggregators are absent or take 20–30% of each order.
Each shop gets its own Telegram bot and brand; the app says "powered by LLS".

**Goal:** every offline point within 20–30 km of one district becomes an online point. Start with
the three pilots (Guliston); next to them grow the district's own delivery network; then one LLS
marketplace on top of both.

> Rules, stack and architecture: `CLAUDE.md`. Product context for design: `PRODUCT.md`.
> Technical debt: `TODO.md`. Owner's launch steps: `docs/launch-checklist.md`.
> Questions for the pilots' meeting: `docs/pilot-meeting.md`.
> The path to the full vision, goal by goal: `docs/goals/README.md` («Дай, друг, дай следующую цель»).

## Current status: stage 1 — money, hours per day and QR poster done; waiting for Cloudflare accounts and the pilots' meeting

| Part | Status | Notes |
|------|--------|-------|
| `@lls/core` | ✅ Done | Domain + use cases, couriers, channel + commission, weight, bottles, stop-list, showcase search, payments and courier cash; 158 tests |
| `@lls/worker` | ✅ Done | Hono API, D1, R2, initData auth (shop bot or LLS bot), roles, bot webhooks, `/market`, `/reconnect`, alerts, money routes, CSV and poster files; 76 tests |
| `@lls/app` | ✅ Done | Storefront, checkout, tracking, reorder, owner section, courier screen, LLS showcase, onboarding, «Деньги», QR poster; 42 tests; 91 KB gzip JS |
| CI | ✅ Done | format, lint, build, test, coverage, 75 e2e scenarios on every push |
| Stand | ✅ Done | `bun run stand` / `bun run e2e`: the whole system locally with a fake Telegram (`docs/e2e.md`) |
| Deploy | 🟡 Ready | Deploy job in `ci.yml` waits for GitHub secrets (`docs/launch-checklist.md`); public-repo hardening in `SECURITY.md` |
| Pilot (food, water, grocery) | ⏳ Next | Three friends' shops, each with its own bot and couriers |

**Blocking:** Cloudflare account, API token and the LLS platform bot — owner tasks in
`docs/launch-checklist.md`.

**Owner decisions still open** (never invent them in code or docs):
- service fee rate and base (goods, or goods + delivery), the pilots' rate;
- who gets the delivery fee for a network delivery, and LLS's share;
- subscription price and trial period;
- delivery supplies: range and prices.

---

## Stages

| Stage | What | Revenue | Status |
|-------|------|---------|--------|
| **1. Online point + district delivery** | **Online point:** storefront, orders, money, own couriers, LLS showcase. **District delivery** (standalone from the first versions): LLS courier bot, a courier for several points, points without couriers served by the network | Service fee on every order (paid by the customer) + subscription + commission on showcase orders + delivery supplies. Delivery: **not decided** (owner decides) | 🔨 Now |
| 2. District marketplace | One cart from several shops, district filter | Commission on marketplace sales + subscription | Later |
| 3. Delivery at scale | Several pickups per trip, routes | Delivery fee + volume terms | Later |

**District metrics:** points online, active couriers, share of orders delivered by network couriers.

**Financial model:** LLS earns on volume, from four sources:
- **Service fee:** paid by the customer on every order through LLS; ≈ turnover through LLS ×
  average fee rate. The shop's prices never change. Showcase orders also carry the showcase
  commission (paid by the shop).
- **Subscription:** a monthly fee for a shop's own bot; ≈ shops × price.
- **Delivery supplies:** LLS-branded packaging, bags and disposable dishes sold to businesses.
  Every bag that reaches a customer also advertises LLS.
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
- [x] Storefront: two-column menu, categories, uz/ru switch, brand color and logo
- [x] Cart per shop, checkout with Telegram contact, location and landmark
- [x] Order tracking and history
- [x] "Мой магазин": orders with status buttons, menu with photos, stats, settings
- [x] Onboarding wizard in the platform bot
- [x] Light and dark Telegram themes; bundle within 100 KB gzip
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

### M4c. LLS showcase ✅
- [x] LLS bot: "Shops and products" button and menu button open the showcase (`?mode=market`)
- [x] One search across showcase shops: Latin or Cyrillic, any apostrophe, word starts; categories
- [x] A tap opens the shop inside the LLS bot; orders get the `marketplace` channel and commission
- [x] Channel fixed by the bot that signed the request; owner/courier screens never open this way
- [x] LLS bot saves phones (contact) and writes showcase customers about their orders
- [x] Admin command `/market <slug> <percent|off>`; the owner is told; owner sees the LLS mark

### M4d. Pre-launch audit ✅
- [x] Shop-signed identities count only inside their shop; phones reach a shop only after they were sent to it
- [x] Pending shops open only for the owner; `/reconnect` when a shop bot fails to connect
- [x] Rate limits on showcase search and sign-up; upload checks; alerts to admins
- [x] Deploy keeps the encryption key; waits for the Worker before connecting the bot
- [x] Backups, restore, frozen migrations documented

### M4e. Local stand and end-to-end checks ✅
- [x] `bun run stand`: local D1, Worker, Mini App, fake Telegram Bot API
- [x] 67 browser scenarios (75 with money) for every role and screen, light and dark, 360 px (`docs/e2e.md`)
- [x] `e2e` job in CI; the deploy waits for it
- [x] Fixed what the run found: bottom sheets, first visit race, courier notices and language,
      admin card, "shop not found"

### M4f. Money, hours per day, QR poster ✅
- [x] Cash or transfer to the shop's card; payment status on every order
- [x] Courier says how the customer paid; cash on the courier's hands; handovers to the owner
- [x] «Деньги»: revenue split, transfers to confirm, debts, refunds, couriers' cash, CSV report
- [x] Working hours per day; QR poster as a PNG in the owner's chat
- [ ] After the meeting with the pilots: service type (carpets, car wash), variants and add-ons,
      pickup and order time, water subscriptions, staff, expenses — only what they confirm

### M5. Deploy and pilot ⏳
- [x] Idempotent deploy workflow (D1, R2, Pages, secrets, migrations, platform bot)
- [ ] Owner: Cloudflare account, API token, platform bot, GitHub secrets (+ saved `TOKEN_ENC_KEY`)
- [ ] First production deploy
- [ ] Production check: connect a test shop → order → statuses → notifications
- [ ] Three friends (food, water, grocery) connect their shops, fill catalogs, invite couriers
- [ ] **First real order**

### M6. District delivery ⏳ (stage 1, right after the pilots' deploy)
- [ ] LLS courier bot; one courier profile per person (name, phone, vehicle)
- [ ] Invite from "Мой магазин" → accept in the courier bot → the business approves
- [ ] The business switches a courier on or off by day; the courier marks "on shift"
- [ ] Every connected courier is offered to join the district network
- [ ] An order of a point without its own courier on shift goes to free network couriers; the
      first who accepts takes it; goods money goes back to that point
- [ ] Orders from several points in one place; cash on hand counted per point
- [ ] Today's shop couriers move to the new model without losing data
- [ ] Decide (owner): who gets the delivery fee for a network delivery, and LLS's share

### M7. Online point in an hour ⏳
- [ ] Pickup: order ahead, collect without a queue
- [ ] We fill the catalog for the point (import from Excel or photos — when a point asks)

### M8. Service fee ⏳
- [ ] Decide (owner): the fee base (goods, or goods + delivery; deposits never count) and the pilots' rate
- [ ] Rate per business: `/fee <slug> <percent>` in the LLS bot (0 allowed)
- [ ] "Сервис" line in the cart, checkout, order screen and bot messages; snapshot in every order
- [ ] The fee in «Деньги» and the CSV
- [ ] Monthly per-shop report "to pay LLS" (fees + showcase commission); admin report for all shops
- [ ] Shop balance with LLS: charged, received, owed; the admin marks "Received from the shop" in
      the LLS bot
- [ ] At the start of a month the bot reminds the shop: the sum and LLS's card number
- [ ] A shop that does not pay for too long: the admin pauses it and its bot stops taking orders

### M9. Subscription ⏳
- [ ] Decide (owner): price and trial period
- [ ] Paid-until date on the shop card for the admin; reminder before it ends
- [ ] Not paid: pause the shop, as in M8

### M10. LLS delivery supplies ⏳ (when the first supplies are in stock)
- [ ] Decide (owner): range (packaging, bags, disposable dishes — all with the LLS brand) and prices
- [ ] Catalog of LLS supplies in "Мой магазин"; the shop orders, the order comes to LLS
- [ ] Delivered by the district delivery; paid in cash or by transfer to LLS's card

---

## After the pilot (only when a real client asks)

- Custom domain
