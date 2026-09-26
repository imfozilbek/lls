# LLS Roadmap

LLS (LocalLoopSolutions): a white-label delivery platform for small businesses in the regions
and districts of Uzbekistan, where Yandex Eats / Uzum do not operate.
Each shop gets its own Telegram bot and brand; the app says "powered by LLS".

> Rules, stack and architecture: `CLAUDE.md`. Product context for design: `PRODUCT.md`.
> Technical debt: `TODO.md`. Owner's launch steps: `docs/launch-checklist.md`.

## Current status: stage 1 — code complete for three shops, waiting for Cloudflare accounts

| Part | Status | Notes |
|------|--------|-------|
| `@lls/core` | ✅ Done | Domain + use cases, couriers, channel + commission, weight, bottles, stop-list, showcase search; 137 tests |
| `@lls/worker` | ✅ Done | Hono API, D1, R2, initData auth (shop bot or LLS bot), roles, bot webhooks, `/market`; 57 tests |
| `@lls/app` | ✅ Done | Storefront, checkout, tracking, reorder, owner section, courier screen, LLS showcase, onboarding; 38 tests; 93 KB gzip |
| CI | ✅ Done | format, lint, build, test, coverage on every push |
| Deploy | 🟡 Ready | Deploy job in `ci.yml` waits for GitHub secrets (`docs/launch-checklist.md`); public-repo hardening in `SECURITY.md` |
| Pilot (food, water, grocery) | ⏳ Next | Three friends' shops, each with its own bot and couriers |

**Blocking:** Cloudflare account, API token and the LLS platform bot — owner tasks in
`docs/launch-checklist.md`.

---

## Stages

| Stage | What | Revenue | Status |
|-------|------|---------|--------|
| **1. Own bot per business + LLS showcase** | Storefront + orders + notifications, own couriers. The LLS bot searches across shops; a tap opens that shop, the order goes to it | Subscription + commission on showcase orders | 🔨 Now |
| 2. District marketplace | One cart from several shops, district filter | Commission on marketplace sales + subscription | Later |
| 3. Own delivery | Shared couriers, several pickups per trip | Delivery fee | Later |

Pilot: **food, water and grocery at the same time.** Sales through a shop's own bot never carry
an LLS commission; only marketplace sales will (stage 2).

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

### M5. Deploy and pilot ⏳
- [x] Idempotent deploy workflow (D1, R2, Pages, secrets, migrations, platform bot)
- [ ] Owner: Cloudflare account, API token, platform bot, GitHub secrets
- [ ] First production deploy
- [ ] Production check: connect a test shop → order → statuses → notifications
- [ ] Three friends (food, water, grocery) connect their shops, fill catalogs, invite couriers
- [ ] **First real order**

---

## After the pilot (only when a real client asks)

- Different working hours per day (see `TODO.md`)
- Custom domain
