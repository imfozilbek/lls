# LLS Roadmap

LLS (LocalLoopSolutions): a white-label delivery platform for small businesses in the regions
and districts of Uzbekistan, where Yandex Eats / Uzum do not operate.
Each shop gets its own Telegram bot and brand; the app says "powered by LLS".

> Rules, stack and architecture: `CLAUDE.md`. Product context for design: `PRODUCT.md`.
> Technical debt: `TODO.md`. Owner's launch steps: `docs/launch-checklist.md`.

## Current status: stage 1 — code complete, waiting for Cloudflare accounts

| Part | Status | Notes |
|------|--------|-------|
| `@lls/core` | ✅ Done | Domain + use cases, 92 tests, domain coverage ≥ 90% |
| `@lls/worker` | ✅ Done | Hono API, D1, R2, initData auth, shop + platform bot webhooks, 43 tests |
| `@lls/app` | ✅ Done | Storefront, cart, checkout, tracking, owner section, onboarding; 29 tests; 96 KB gzip |
| CI | ✅ Done | format, lint, build, test, coverage on every push |
| Deploy | 🟡 Ready | `deploy.yml` waits for GitHub secrets (`docs/launch-checklist.md`) |
| Pilot (food) | ⏳ Next | After the first deploy |

**Blocking:** Cloudflare account, API token and the LLS platform bot — owner tasks in
`docs/launch-checklist.md`.

---

## Stages

| Stage | What | Revenue | Status |
|-------|------|---------|--------|
| **1. Own bot per business** | Storefront + orders + owner notifications. Business delivers itself | Subscription | 🔨 Now |
| 2. District marketplace | One Mini App, one cart from several shops, search across shops | Commission + subscription | Later |
| 3. Own delivery | Shared couriers, several pickups per trip | Delivery fee | Later |

Pilot order: **food → water → grocery.**

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

### M5. Deploy and pilot ⏳
- [x] Idempotent deploy workflow (D1, R2, Pages, secrets, migrations, platform bot)
- [ ] Owner: Cloudflare account, API token, platform bot, GitHub secrets
- [ ] First production deploy
- [ ] Production check: connect a test shop → order → statuses → notifications
- [ ] Friend with food connects the shop and fills the menu
- [ ] **First real order**

---

## After the pilot (only when a real client asks)

- Water shop: `reorder` and `bottleDeposit` features
- Grocery: `weightItems`, `stopList`
- Different working hours per day (see `TODO.md`)
- Custom domain
