# CLAUDE.md

> **ALL RULES ARE MANDATORY. Zero tolerance for violations.**

## Session Start

1. Read `./ROADMAP.md` to understand current status.
2. If ROADMAP.md conflicts with this file, **this file wins**.

The old NestJS + MongoDB code is kept only at git tag `legacy-v0`. Reuse ideas from it, never its bugs.

## Project Overview

Zumda: local delivery platform for small businesses (Uzbek *zumda*, "in a moment").
Company name, where a full one is needed: **Zumda Shop**. Domain: `zumda.shop`.
GitHub repository: `imfozilbek/lls`: it keeps this name (owner's decision); do not rename it.
TypeScript monorepo (Bun workspaces). Bun 1.3.

**Target market:** small businesses in regions and districts of Uzbekistan, where aggregators
are absent or take 20–30% of each order (Uzum Tezkor has worked in Guliston since April 2025).
**The goal: every offline point within 20–30 km of one district becomes an online point.** Today
the customer has to come to the point; with Zumda they order from home and a courier brings it.
Start with the three pilots; next to them grow the district's own delivery network, then one
Zumda marketplace on top of both.

| Package | Description |
|---------|-------------|
| `@zumda/core` | Domain logic (DDD): entities, value objects, use cases, ports. Pure TS, no deps |
| `@zumda/worker` | Cloudflare Worker: HTTP API (Hono) + Telegram bot webhooks |
| `@zumda/app` | Telegram Mini App (React), hosted on Pages: customer storefront, owner section "Мой магазин", courier section, shop onboarding |

Two products on one platform, both in stage 1: the **online point** (a shop's own bot, orders,
money, showcase) and **district delivery** (Zumda courier bot, couriers for many points).

## White-Label Model

Zumda is the platform brand. Customers see the **shop's brand**; the app shows a small "powered by Zumda".

- **Three Zumda bots, one per role (owner's decision, October 2026), named «Zumda | Shop»,
  «Zumda | Business», «Zumda | Kuryer» (the deploy sets the names):**
  - **Zumda | Shop (`@zumdashop_bot`, `PLATFORM_BOT_TOKEN`):** customers only: the showcase,
    search, and messages about showcase orders.
  - **Zumda | Business (`@zumdashop_business_bot`, `BUSINESS_BOT_TOKEN`):** owners and platform admins: «Mening bizneslarim»
    (`?mode=business`), applications, all messages to owners and admins about their businesses
    (application, approval, showcase deal, alerts), the admins' approval buttons and commands
    (`/reconnect`, `/market`, `/district`, `/network`). It creates and manages the shops' bots
    (Bot Management Mode on).
  - **Zumda | Kuryer (`@zumdashop_kuryer_bot`):** one bot for every courier of every shop.
- **One bot per shop.** The chat, name and avatar are the shop's. The owner creates it with one
  button in Zumda | Business («Bot yaratish», Telegram **Managed Bots**, goal 14): the bot lives
  in the owner's own Telegram account, Zumda | Business manages it and gets its token by itself
  (`managed_bot` → `getManagedBotToken`); the owner never sees a token. A bot from BotFather still
  connects by pasting its token («Menda bot bor»). Order messages to the owner come from the
  shop's own bot.
- **«Mening bizneslarim».** Zumda | Business opens the Mini App with `?mode=business`: all of the
  owner's businesses, and the full owner section of any of them right there (`X-Bot: business`).
- **One Worker serves all bots:** webhook `/tg/:botId` for shop bots, `/tg/platform` for
  Zumda | Shop, `/tg/business` for Zumda | Business, `/tg/courier` for Zumda | Kuryer.
- **One Mini App for all shops.** The shop bot's menu button opens it with `?shop=<slug>`.
- **Per-shop branding:** name, logo, brand color. Everything else is shared.
- **Zumda's look (owner's decision, October 2026):** the mark is a green pin with a house
  (`brand/`, scheme "Bog'": `#15803D`, `#14532D`, mint `#DCFCE7`); a new shop is green until the
  owner picks a color.
- **Zumda sets the shop bot's picture and description** (`setMyProfilePhoto`, `setMyDescription`,
  `setMyShortDescription` with the shop's token): the picture is the shop's logo, or its name on
  its color when there is no logo, with the Zumda mark at the bottom right. The app draws it
  (canvas) on connecting, on a new logo, and on a new name or color while there is no logo; the
  descriptions are set on approval and on a new name, always with «Zumda asosida ishlaydi».

## Product Stages

| Stage | What | Revenue |
|-------|------|---------|
| **1. Online point + district delivery (NOW)** | **Online point:** the pilot shops' whole process: found → order → delivery → **paid**, and the owner sees where the money is. **Zumda showcase**: search across shops in the Zumda bot, the order goes to one shop. **District delivery** (standalone from the first versions): the Zumda courier bot; a courier works for several points; points without couriers are served by the district network | Service fee on every order (paid by the customer) + subscription + commission on showcase orders. Delivery revenue: **not decided** (the owner decides) |
| 2. District marketplace | One cart from several shops, district filter | Commission on marketplace sales only |
| 3. Delivery at scale | Several pickups per trip, routes | Delivery fee + volume terms |

**Pilot:** Jasur (national food; car and carpet cleaning), Maqsudbek (burgers; coffee and drinks),
Zoir (20 l water production and delivery). Each business has its own bot. The first launch must
cover each one's whole process; what exactly comes from the meeting with them.

**Money rules of the platform** (Zumda earns on volume):
- **Customers pay only by transfer to the shop's card, before the shop starts** (owner's
  decision, October 2026). The order is placed unpaid → the customer transfers and presses
  «Я перевёл» → the owner sees the money and presses «Деньги пришли, принять» (paid and
  accepted in one tap). An order is never accepted unpaid (`PAYMENT_REQUIRED`). No cash: couriers
  carry no money, there is no courier cash, no handovers, no debts.
- **Many cards, one shown.** A shop keeps as many cards as it needs (up to 20) and chooses the
  **payment card** customers are shown; it switches it at any moment (owner's decision). Every
  order keeps the card it was shown (`payment_card_*` snapshot). The payment card is never
  removed.
- **No card, no orders.** The first card is a required onboarding step; a shop without one
  shows «Tez orada buyurtma qabul qila boshlaydi» and refuses orders (`NO_PAYOUT_CARD`).
- **Zumda service fee (plan: not in code yet):** a small percentage on **every** order through Zumda,
  in any channel (shop bot, showcase, district delivery). The **customer** pays it as a separate
  "Сервис" line in the cart, the order and the messages. The shop's prices never change: the shop
  gets its price in full.
- The rate is set per business by a platform admin, like `/market`: `/fee <slug> <percent>`.
  Zero is allowed (pilots).
- Every order stores a **service fee snapshot** (rate + amount, integer UZS), fixed when the
  order is placed; 0 when the rate is 0. Computed only on the server.
- No payment gateways: the shop receives the fee with the order's transfer and pays Zumda the
  month's fees by a monthly per-shop report.
- Not decided (the owner decides, never invent): the fee base (goods, or goods + delivery; bottle
  deposits never count), and the pilots' rate.
- **Showcase commission** stays separate: a share of the goods that the shop pays on showcase
  orders only (0 for `shop_bot`).
- Subscription for the shop's own bot: a separate deal.

**District delivery (stage 1):**
- **Done (goal 05):** one Zumda courier bot for all couriers. One courier profile per `telegram_id`
  (name, phone, vehicle, shift) plus a courier↔business link (`couriers` row: status
  pending/active/removed, working days, "not today").
- **Done:** only a business invites a courier: an invite from "Мой магазин" → the person accepts
  it in the courier bot → the business approves (bot button or app) and switches the courier on or
  off by day (like the menu's stop-list). The courier marks "on shift" himself (until midnight).
  An order goes only to a courier who is approved, works today and is on shift.
- **Done:** a business never sees its courier's other businesses. Couriers carry no money: every
  order is paid to the shop's card before cooking.
- **Done (goal 06):** every courier a business approves is **offered** once to deliver for other
  points of the district too (`in_network`, only the courier's own consent).
- **Done:** a district is a circle (center + radius) the platform admin sets in the Zumda bot:
  `/district <name> <lat>,<lng> <km>`, `/district <name> wait <min>`; `/network` shows it.
  A shop belongs to the district its location falls in.
- **Done:** when the shop accepts an order and none of its own couriers can take it now, the
  order goes to the free network couriers of the district (in the network, on shift, carrying no
  other network order): «Новый заказ рядом» without the customer, «Беру»; the first press wins
  (one conditional UPDATE). The shop switch «Если мои заняты, отдавать сети района» is **on by
  default** (owner's decision); the owner may also hand an order over by hand. The customer paid
  that point's card before cooking: the network courier carries no money. Nobody took it in
  `wait` minutes (default 10):
  the shop and the admins hear it once (no cron: checked on every network event and `/network`).
- **Temporary rule (owner decides later, goal 02):** the delivery fee of a network order stays
  with the shop and Zumda takes no share. It is a snapshot in the order (`delivery_fee_to`), set in
  one place (`NETWORK_DELIVERY_FEE_RECIPIENT`).

**⛔ RULES:**
- Build ONLY stage 1 now: the online point and district delivery. Money is in: only a transfer to
  the shop's card, before the shop starts (unpaid → «Я перевёл» → paid by the owner's
  «Деньги пришли, принять»; refund due / refunded after a cancel), money report and CSV export.
  **No cash, no payment gateways (Click, Payme)**: the owner confirms transfers by hand.
- Services (carpet and car cleaning) join stage 1 as their own business type once their process
  is agreed with the client.
- The Zumda showcase is in: search across shops + shop list in the Zumda bot;
  a tap opens that shop's storefront inside the Zumda bot; cart and order stay per shop.
- Still forbidden: shared cart, algorithmic order dispatch (couriers accept orders themselves),
  routing, settlements or payouts between businesses through Zumda.
- Not decided (ask the owner, never invent): who gets the delivery fee when a network courier
  delivers, and whether Zumda takes a share of it. Until then: the shop keeps it (temporary rule).
- Only shops with a marketplace deal (`business.marketplace`) appear in the showcase. A platform
  admin sets the deal in the Zumda bot: `/market <slug> <percent>` or `/market <slug> off`.
- **Kinds of business (owner's decision, October 2026):** «Oziq-ovqat do'koni» (`grocery`),
  «Restoran» (`food`), «Xizmat ko'rsatish» (`service`). A water shop is a grocery store with the
  bottle deposit on (migration `0007` moved old `water` rows). Services use the normal order flow
  with their own words until their process is agreed (goal 09).
- One universal core for all business types. Vertical specifics = feature toggles per business:
  `reorder`, `bottleDeposit` (water), `weightItems` and `stopList` (grocery, food). Defaults come
  from the business type; the owner can switch them.
- Add a feature only when a real client asks for it.
- Design stage 1 so stages 2–3 need no rewrite:
  - multi-tenant: `business_id` in every business-owned table
  - one global customer per `telegram_id` + customer↔business link
  - shared category taxonomy + units (шт, кг, л, 19 л)
  - geo: business location + delivery zone, customer location
  - every order stores its **channel** (`shop_bot` | `marketplace`) and a **commission snapshot**
    (rate + amount, integer UZS, 0 for `shop_bot`), fixed when the order is placed
  - every order stores a **service fee snapshot** (rate + amount, integer UZS): plan, see
    "Money rules"
  - couriers: one global profile per `telegram_id` (`courier_profiles`) + courier↔business
    links (`couriers` rows, their ids stay in orders)

## SLC Rules (MANDATORY)

**⛔ SLC, NOT MVP.** We build **SLC (Simple, Lovable, Complete)**:
- **Simple**: easy to use, no unnecessary complexity
- **Lovable**: delightful UX, polished design
- **Complete**: fully working, no "coming soon" placeholders

| Rule | Requirement |
|------|-------------|
| **v1.0 scope** | Stage 1: orders, status tracking, money, shop couriers, district delivery, vertical toggles |
| **Quality** | Must be PERFECT, not "good enough" |
| **No scope creep** | Shared cart, algorithmic dispatch, routing, multi-city, payment gateways: NOT in v1.0 |
| **UX** | Order in 3 taps |
| **Cost** | $0/month until real usage requires more |

## Task Workflow (MANDATORY)

**⛔ Enter plan mode before any task that changes files.**

| Rule | Requirement |
|------|-------------|
| **Tasks that change files** | Use `EnterPlanMode` first |
| **Questions, analysis, research** | No plan mode needed |
| **Approval** | `ExitPlanMode` asks the user to approve. Start work only after approval |

## Transparency (MANDATORY)

**Claude MUST immediately report:**

| Situation | Action |
|-----------|--------|
| Error/failure | Report what failed and why |
| Blocker | Explain what blocks progress |
| Uncertainty | Ask instead of guessing |
| Skipped step | Explain why step was skipped |
| Assumption made | State the assumption explicitly |

**⛔ FORBIDDEN:**
- Silent failures: always report errors
- Skipping without explanation
- Guessing instead of asking
- Hiding problems hoping they resolve
- Pretending task is done when it's not

## Self-Correction (MANDATORY)

**When Claude makes an error caused by CLAUDE.md rules:**

| Step | Action |
|------|--------|
| 1 | Identify which rule in CLAUDE.md caused the error |
| 2 | Explain why the rule is incorrect |
| 3 | Propose fix to CLAUDE.md immediately |
| 4 | Ask user to approve the change |

**⛔ RULES:**
- If error repeats twice: rule MUST be updated
- Never ignore systematic errors
- Fix the root cause, not symptoms

## No Laziness (MANDATORY)

**Claude MUST complete tasks fully:**

| Rule | Requirement |
|------|-------------|
| **Context limits** | IGNORE: autocompact handles it |
| **Long tasks** | Do ALL steps, never cut short |
| **Many files** | Edit ALL files, not "and so on..." |
| **Repetitive work** | Do it fully, no shortcuts |
| **"To save time"** | FORBIDDEN excuse |

**⛔ NEVER:**
- Stop early to "save context"
- Say "you can do the rest similarly"
- Skip files/steps for "brevity"
- Summarize instead of doing
- Offer to continue "if needed"

## Session Commands (MANDATORY)

### "start-work"
| Step | Action |
|------|--------|
| 1 | Analyze entire project (structure, TODOs, open tasks, component status) |
| 2 | Show brief status for each project part |
| 3 | Sort by progress (completed first, least ready last) |
| 4 | Bottom: show blocking/lagging task |

### "Дай, друг, дай следующую цель" (next goal)
The path to the full product vision is split into goals in `docs/goals/` (index: `README.md`).
| Step | Action |
|------|--------|
| 1 | Open `docs/goals/README.md`; take the first goal from the top that is not ✅ and whose dependencies are ✅ |
| 2 | If it waits for the owner (keys, a decision, a meeting): say exactly what is needed and offer the next goal that does not |
| 3 | Show the goal briefly: why, what will be done, what is needed from the owner |
| 4 | Work by these rules: plan mode → approval → atomic commits with gates → PR watched until merged |
| 5 | Mark ✅ only when the whole Definition of done is met; update the goal and the index in the same PR |

### "end-work"
| Step | Action |
|------|--------|
| 1 | Check uncommitted changes (`git status`, `git diff`) |
| 2 | Commit and push. Release only if the user asks |
| 3 | Review git log for last 12 hours |
| 4 | Show summary: what was done, progress achieved |

## Commands

```bash
bun run build                                  # Build all (includes type check)
bun run test                                   # Test all
bun run format                                 # Format (4 spaces)
bun run lint                                   # Lint (0 errors, 0 warnings)
bun run dev                                    # Dev mode
bun run --filter @zumda/core build               # Build specific package
bunx wrangler dev                              # Run Worker locally (in packages/worker)
bunx wrangler d1 migrations apply zumda --local  # Apply D1 migrations locally (default)
bunx wrangler d1 migrations apply zumda --remote # Apply D1 migrations in production
bunx wrangler types                            # Regenerate Env types after wrangler.jsonc changes
bunx wrangler deploy                           # Deploy Worker
scripts/check-access.sh                        # Launch keys work? (Cloudflare, bots; read-only)
scripts/check-dashes.sh --all                  # No em dash anywhere (CI and pre-commit too)
gh api -X POST repos/imfozilbek/lls/dispatches -f event_type=deploy  # Deploy main again (Claude)
```

## Architecture (DDD + Clean Architecture)

```
Domain (inner)     → Entities, Value Objects, Errors: NO framework imports
Application        → Use Cases, Ports (interfaces), DTOs
Infrastructure     → Routes, Repositories, Adapters (@zumda/worker)
```

**RULES:**
- Domain NEVER imports from outer layers
- Entities have behavior, not just data
- Value Objects are immutable
- API returns DTOs, not entities
- No magic numbers/strings
- No hardcoded secrets

## Worker Architecture (@zumda/worker)

```
src/
├── index.ts          # Worker entry
├── app.ts            # Hono app: CORS, /health, /api, /img, /tg
├── env.ts            # Bindings (DB, BUCKET) + secrets
├── crypto.ts         # initData HMAC check, AES-GCM for bot tokens
├── auth.ts           # X-Shop / X-Bot → bot token → verify initData → user + role (owner/customer/courier)
├── services.ts       # Wires repositories, gateway and use cases
├── http/             # Error mapping, zod schemas, image upload
├── routes/           # customer, owner, courier, platform, image, webhook
├── repositories/     # D1 implementations of @zumda/core ports
└── telegram/         # Bot API gateway, texts (Uzbek, per business type), notifier
scripts/              # Local dev only: seed-dev.ts, sign-init-data.ts
wrangler.jsonc        # Bindings: DB (D1), BUCKET (R2), vars; run `wrangler types` after changes
migrations/           # D1 SQL migrations
```
No cron: add `scheduled()` only when a real client needs a timed job.
Alerts: 5xx errors and failed notifications reach `PLATFORM_ADMIN_IDS` through the Zumda bot
(`src/alerts.ts`, one per kind per 10 min). "Bot blocked by the user" is not an alert.
```
```

**Worker Rules:**
- Worker is a thin layer. Business logic lives in `@zumda/core` use cases.
- Every body, query and param is validated with zod.
- Identity (customer, owner, courier) comes ONLY from verified Telegram data, never from the request body.
- Check ownership on every route that reads or changes business-owned data.
- DomainError → HTTP: validation 400, unauthorized 401, forbidden 403, not found 404,
  conflict / invalid status transition 409, business rule 422.
- Frameworks: Hono + zod only. No NestJS, no Express, no ORM.

## Domain Models

| Entity | Key Fields |
|--------|------------|
| Business | id, slug, name, type (grocery/food/service), owner_telegram_id, status (pending/active/disabled), bot (id, username, encrypted token, webhook secret), brand (color, logo_key), location, address, delivery (radius, fee, free_from, min_order), working_hours (per day), features, accepting_orders, bottle_deposit, marketplace (commission rate, joined_at) or none, payout cards (list in `payout_cards`, up to 20) + payment card (the one customers see; required to take orders), service fee rate (bps; plan), district_id, network_delivery (on by default) |
| Product | id, business_id, name, description, price (integer UZS per unit), unit, step (grams for kg), category (shared taxonomy), image_key, is_available, unavailable_until (stop-list for today), returnable (19 l bottle) |
| Customer | id, telegram_id (global, unique), name, phone (from Telegram contact), language |
| CustomerBusiness | customer_id, business_id, first_order_at: whose customer this is |
| District | id, name, center (lat, lng), radius, wait_minutes: a circle of the delivery network |
| CourierProfile | id, telegram_id (global, unique), name, phone, vehicle, shift_until, in_network, network_offered_at: the person |
| Courier | id, business_id, telegram_id, status (pending/active/removed/network), work_days, off_until: the person's link to one shop (`network`: took a network order of it) |
| Order | id, business_id, number (per shop), customer_id, channel, items (name + unit + category + price + total snapshot), subtotal, delivery_fee, deposit_total, bottles_returned, total, commission (rate + amount), status, courier, address, location, landmark, comment, cancel_reason, payment (method card_transfer: `cash` only in old rows; status unpaid/awaiting/paid/refund_due/refunded, paid_at; card shown: snapshot; cash courier: history only), delivered_at, network_requested_at, network_alerted_at, delivery_fee_to (snapshot), service fee (rate + amount; plan) |
| CashHandover | History only: the `cash_handovers` table stays (additive schema), no code uses it since payments became transfer-only |

**Money:** integer UZS. Never floats. Quantities are integers too: pieces, or **grams** for `kg`
items; line total = `round(price × grams / 1000)`.

**Order Status Flow (single source of truth: `@zumda/core` enum):**
```
pending → accepted → preparing → ready → picked_up → delivered
    ↓         ↓          ↓         ↓         ↓
cancelled  cancelled  cancelled  cancelled  cancelled
```
- `pending → ready` = shop part. `picked_up → delivered` = delivery part.
- `pending → accepted` only when paid: the owner's «Деньги пришли, принять» confirms the transfer
  and accepts in one step (`Order.advanceTo` refuses an unpaid accept).
- Owner moves every step and may cancel. The assigned courier moves only
  `ready → picked_up → delivered` and never cancels. The customer cancels only while `pending`.
- The owner assigns a courier (`accepted`…`ready`); without couriers the owner delivers.
- Only ONE transitions table (and one actor rule next to it) in the codebase.

## Database (Cloudflare D1)

**⛔ D1 is the only database. No MongoDB, Redis, Postgres or others without an explicit decision.**

**D1 (SQLite):**
```typescript
// Schema changes ONLY via SQL migrations: packages/worker/migrations/*.sql
// Always: parameterized queries, db.prepare(sql).bind(...)
// Always: index every WHERE / ORDER BY column (free tier counts ROWS READ, not queries)
// Index: business_id, customer_id, status, created_at, telegram_id, slug
// Multi-statement writes: db.batch([...]) (runs as one transaction)
// Money: INTEGER (UZS). Timestamps: INTEGER (unix ms), UTC
```

**Migrations after the first production deploy (⛔):**
- `0001_init.sql` and every applied migration are FROZEN. A change = a NEW file `NNNN_<what>.sql`.
- Migrations run BEFORE the new Worker goes live, so the old Worker must still work on the new
  schema: only additive changes (new table, nullable column or column with a default, index).
  Renames and drops go in two releases: stop using it first, remove it in a later migration.

**Backups:** D1 Time Travel (7 days) + a weekly local `wrangler d1 export`. Never export in CI:
the repository is public. Steps: `SECURITY.md` → "Backups and restore".

**Files:** product photos in R2. Store only the key in D1.

**No cache layer.** Add one only when measurements show a need.

## API Design

| Action | Method | Path | Status |
|--------|--------|------|--------|
| List | GET | `/resources` | 200 |
| Get | GET | `/resources/:id` | 200/404 |
| Create | POST | `/resources` | 201 |
| Update | PATCH | `/resources/:id` | 200/404 |
| Delete | DELETE | `/resources/:id` | 204/404 |

**List response (always):** `{ data: T[], meta: { page, limit, total } }`

**Error response (always):** `{ error: { code, message, details? } }`. For business rules `code` is
the rule id (e.g. `PHONE_REQUIRED`, `SHOP_CLOSED`) so the app can show a translated message.

## Telegram

**Mini App validation:**
```typescript
// ALWAYS validate initData on the Worker with WebCrypto:
//   secret = HMAC_SHA256(key="WebAppData", msg=bot_token)
//   hash   = HMAC_SHA256(key=secret, msg=sorted "key=value" lines joined by "\n")
// Constant-time compare. Reject auth_date older than 24h or in the future
// Never trust client-side data without validation
```

**Bot webhook:**
- Register with `setWebhook` + `secret_token`. Reject requests without a matching
  `X-Telegram-Bot-Api-Secret-Token` header.
- Button presses: user = `callback_query.from.id`. Check that this user owns the business.

**Which token verifies initData:** Telegram signs initData with the token of the bot that opened
the Mini App. The app sends `X-Shop: <slug>` → Worker loads that shop's bot token → verifies.
No `X-Shop` → verify with the platform bot token (showcase search).
`X-Shop` + `X-Via: marketplace` → verify with the **platform** bot token; the shop must be active
and in the marketplace. `X-Bot: business` → verify with `BUSINESS_BOT_TOKEN`: without `X-Shop`
the role is `business` («Mening bizneslarim», applications: `/api/platform/*` accept only this,
anyone else 403 `BUSINESS_BOT_ONLY`); with `X-Shop` only the shop's owner gets in (role `owner`),
anyone else 403.
The token that verified the signature decides the order channel
(`shop_bot` or `marketplace`); the client can never choose it.

**Bot tokens:** stored in D1 encrypted with AES-GCM (key: secret `TOKEN_ENC_KEY`). Never logged,
never returned by the API. Validate a new token with `getMe` before saving. A managed bot's token
comes from `getManagedBotToken` on its `managed_bot` update (table `managed_bots` until an
application takes it); a new token of a live shop's bot reconnects it at once; a new owner of the
bot alerts the admins and never moves the shop. Telegram may not announce a token changed in
@BotFather, so the current token is fetched again before every use (application, approval,
`/reconnect`).

**Roles** (per shop, one app, one auth): `customer` (default), `owner`
(`business.owner_telegram_id`). Through the showcase (`X-Via: marketplace`) the role is always
`customer`. `X-Bot: courier` → initData is verified with `COURIER_BOT_TOKEN`, no shop, role
`courier`; which shops and orders they may touch, the use cases check by the links.

**Entry:** the shop bot's menu button opens `?shop=<slug>`. The Zumda courier bot opens
`?mode=courier` (all the courier's shops in one screen). «Mening bizneslarim»: Zumda | Business
opens `?mode=business` (old buttons: `?mode=onboarding`). Showcase: Zumda | Shop opens
`?mode=market`.

**Courier invite:** the owner creates a one-time link `t.me/<courier_bot>?start=c_<code>` (48 h).
`/start c_<code>` in the Zumda courier bot (webhook `/tg/courier`) makes the sender a **pending**
courier of that shop and asks for the phone; the owner gets "Подтвердить / Отклонить" from the
shop bot (`k:<courierId>:approve|decline`) or approves in "Мой магазин".

**Notifications (no WebSockets):**
- New order → message to the owner «💳 Ждём перевод» with «Деньги пришли, принять» + «Отменить»;
  the customer gets the shop's card and the sum. «Я перевёл» → the owner hears «Клиент перевёл».
  After that the owner's button is the **next allowed status**.
- Courier assigned → order card from the Zumda courier bot, titled with the shop's name (address,
  landmark, map, phone, «Оплачено заранее: денег не брать», empty bottles) with "Забрал", then
  one "Доставил".
- Status change → message to the customer (courier name, never the courier's phone). Showcase
  orders: the Zumda bot writes to the customer (with the shop name); the owner still gets messages
  from the shop bot.
- Texts depend on the business type (grocery: «Katalog», «Yig'ilmoqda»; food: «Menyu»,
  «Tayyorlanmoqda»; service: «Xizmatlar», «Bajarilmoqda»).
- Before the first order, the app calls `requestWriteAccess()` so the shop bot may message the customer.
- Phone: `requestContact()` → Telegram sends a `contact` message to the bot that opened the app
  (shop bot or Zumda bot) → save it only if `contact.user_id === from.id`.

**Regional UX (required):**
- Language: **Uzbek (Latin) only** (owner's decision, October 2026): no Russian anywhere in the
  product (app, bots, owner and courier guides). The dictionary mechanism stays (`Language`, one
  dictionary per language, no heavy i18n library): another language is one more dictionary.
  Telegram's `language_code` and old `ru` rows read as Uzbek.
- Address: Telegram location + "ориентир" (landmark) field
- Phone: Telegram "share contact" button, never typed by hand
- Payment: only a transfer to the shop's card, shown at checkout with a copy button and the sum;
  the customer transfers after placing and presses «Я перевёл»; the owner confirms by hand
  («Деньги пришли, принять»), then the shop starts

**User Flow:**
- Customer: Open shop link → Browse → Cart → Order → Transfer → «Я перевёл» → Track
- Showcase customer: Zumda bot → Search → Shop → Cart → Order → Track
- Owner: New order message → the transfer arrives → «Деньги пришли, принять» → Next status →
  assign courier; catalog, couriers and the card in "Мой магазин"
- Courier: Invite link → Zumda courier bot → phone → approved → "on shift" → assigned order card →
  Picked up → Delivered
- Network courier: approved by a point → «Да, для района» in the Zumda courier bot → "on shift" →
  «Новый заказ рядом» → «Беру» → full card → Picked up → Delivered

## Security (MANDATORY)

**FORBIDDEN:**
```typescript
eval(userInput)                        // Code injection
new Function(userInput)                // Code injection
document.innerHTML = x                 // XSS
`SELECT ... WHERE id = ${userInput}`   // SQL injection: use D1 .bind()
```

**REQUIRED:**
- Secrets: `wrangler secret put` in prod, `.dev.vars` locally (never committed)
- Validate all inputs with zod (especially Telegram data)
- Never log passwords/tokens/secrets
- Verify Telegram initData on every request
- Prices, totals, the service fee and `customerId` are computed on the server. Never trust them from the client
- Check ownership on every route (owner edits only own shop, customer sees only own orders)
- Frontend NEVER talks to D1/R2 directly. Only through the Worker
- CORS: allow only the Mini App's three addresses (`APP_ORIGIN`, `BUSINESS_APP_ORIGIN`,
  `COURIER_APP_ORIGIN`)
- Zumda | Business in a browser (business.zumda.shop): Telegram Login Widget → `POST
  /api/business/session` checks the widget's signature with the bot token → a 30-day session
  (`BUSINESS_SESSION_SECRET`) in `Authorization: Bearer`, the same rights as `X-Bot: business`.
  No cookies; the widget's domain is set once in @BotFather (`/setdomain`)
- Check `git diff` before commit

**Public repository (GitHub, free CI):** the code is public, the keys never are.
- Workflows: `permissions: contents: read`; actions pinned to a commit SHA; `persist-credentials: false`.
- Secrets only in the deploy job, only in the step that needs them, only for `main` of this
  repository (a push, a manual run or the `deploy` dispatch event). **NEVER** `pull_request_target` or `workflow_run` with secrets or with
  checked-out PR code. Never `${{ github.event.* }}` text inside `run:` (script injection).
- `scripts/check-secrets.sh` runs in CI and as the git pre-commit hook; fake test keys carry a
  `secret-scan: fake` comment. Details and the leak playbook: `SECURITY.md`.

## Performance (MANDATORY)

| Metric | Limit |
|--------|-------|
| API response | < 200ms (p95) |
| DB query | < 100ms |
| Worker CPU | < 10ms per request |
| Worker memory | < 128MB |
| Mini App initial JS | ≤ 100 KB gzip (regional mobile internet is slow) |

**AVOID:**
- N+1 queries: use JOIN or `db.batch`
- Missing indexes
- `SELECT *`: select needed columns
- No pagination
- Heavy libraries in the Worker or the customer bundle

## Free Tier Limits

| Service | Free limit | Upgrade when |
|---------|-----------|--------------|
| Workers | 100,000 requests/day, 10 ms CPU/request, 50 subrequests/request | > 70k requests/day → Workers Paid ($5/mo) |
| D1 | 500 MB per database, 5M rows read/day, 100k rows written/day, 7-day Time Travel | DB > 400 MB or reads near limit |
| R2 | 10 GB storage, free egress | > 8 GB |
| Pages | Static hosting, `*.pages.dev` | Not needed |
| Cron Triggers | 5 per account | - |

**⛔ Design to stay free:** no polling faster than 15 s, paginate lists, index queries.

## Code Style (MANDATORY)

```
4 spaces | no semicolons | double quotes | 100 chars max | trailing commas
```

**⛔ No em dash (U+2014) anywhere** (owner's decision, October 2026): code, comments, product texts
(Uzbek), docs, commit messages, PRs, bot descriptions. Use a colon, a comma, a period or a hyphen
" - " instead, whichever reads naturally. `scripts/check-dashes.sh` runs in CI and in the git
pre-commit hook (generated `worker-configuration.d.ts` is skipped).

## ESLint Rules (MUST FIX ALL)

| Rule | Fix |
|------|-----|
| `no-explicit-any` | Use `unknown`, generics, proper types |
| `explicit-function-return-type` | Always: `function foo(): string` |
| `no-floating-promises` | Always `await` or `.catch()` |
| `no-unused-vars` | Prefix with `_` |
| `prefer-const` | Use `const` unless reassigning |
| `eqeqeq` | Use `===` and `!==` |
| `curly` | Always use braces |
| `no-console` | Only `console.warn` / `console.error` |
| `max-params` | Max 5. Need more: pass one object |
| `max-lines-per-function` | Max 100 |
| `complexity` | Max 15 |
| `max-depth` | Max 4 |

## Forbidden Patterns

```typescript
any                    // Use proper type
as any                 // Fix the type
// @ts-ignore          // Fix the error
x!.y                   // Non-null assertion: use a null check
var                    // Use const/let
==                     // Use ===
console.log            // Use logger
```

## Import Order

```typescript
// 1. Built-ins
// 2. External packages
// 3. @zumda/* packages
// 4. Relative (parent first)
// 5. Type-only imports
```

## UI Development (MANDATORY)

**⛔ WORKFLOW for any UI task:**
1. Read `.skills/brand-guidelines/SKILL.md` first
2. Plan screens with animations and micro-interactions
3. Result must NOT look "AI-generated": must feel human-crafted

**UI Stack:**
| Task | Stack |
|------|-------|
| Mini App (customer + owner) | React + Vite + Tailwind, the light palette + brand tokens. **Always light** (owner's decision): Telegram's dark theme is ignored; its header, background and bottom bar are painted white |
| Font | System font (per brand guidelines): 0 KB, native look in Telegram |
| Animations | CSS transitions/keyframes with custom easing and timing. Motion library only where CSS is not enough |
| Owner section ("Мой магазин") | Same Mini App, lazy-loaded chunk (customers never download it) |

**⛔ FORBIDDEN:**
- Arbitrary colors: only the brand palette and the light palette
- Interactive elements without pressed (`active`) and focus states
- Colors outside the light palette (`--ui-*` in `packages/app/src/index.css`, shown as `tg-*`
  classes)

**REQUIRED:**
- Micro-interactions on all interactive elements
- Personality: custom icons and empty states with character (no stock illustrations)

## Skills Usage (MANDATORY)

| Skill | When to Use | Status |
|-------|-------------|--------|
| `brand-guidelines` | Before any UI work: colors, typography, spacing | In repo: `.skills/brand-guidelines/` |
| `ddd` (plugin) | New features, refactoring, architecture decisions | Use if installed |
| `tdd` (plugin) | Writing or updating tests | Use if installed |

**⛔ RULES:**
- Invoke skills proactively, don't wait for the user to ask
- If a needed skill is not installed, tell the user and give the install commands:
  ```bash
  /plugin marketplace add NeoLabHQ/context-engineering-kit
  /plugin install ddd@NeoLabHQ/context-engineering-kit
  /plugin install tdd@NeoLabHQ/context-engineering-kit
  ```

## Testing (MANDATORY)

| Layer | Min Coverage |
|-------|--------------|
| Domain | 90% |
| Use Cases | 80% |
| Routes | 70% |

**Tooling:** Vitest 4.1 (required by `@cloudflare/vitest-plugin`).
- `@zumda/core`, `@zumda/app`: plain Vitest (node environment).
- `@zumda/worker`: `@cloudflare/vitest-plugin`: tests run in workerd with real D1; migrations are
  applied in `test/setup.ts`. Telegram calls go through a `TelegramGateway` interface, faked in tests.

Measure with `vitest run --coverage` (core: `@vitest/coverage-v8`, worker: `@vitest/coverage-istanbul`).

## Git Commits

```
<type>(<package>): <subject>
feat(worker): add order routes
fix(app): resolve cart issue
docs: update roadmap              # no package for repo-wide changes
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

**⛔ NEVER add Co-Authored-By or a Claude Code footer.**

### Pull Requests

**⛔ Watch every PR Claude opens until it is merged or closed.**

| Step | Action |
|------|--------|
| 1 | Right after creating the PR, subscribe to its activity (CI, reviews, comments) |
| 2 | CI red → find the root cause, fix, pass the quality gates locally, push |
| 3 | Review comment → fix it, or reply why not |
| 4 | Report to the user only when the PR is green, blocked, or needs a decision |
| 5 | Stop watching when the PR is merged or closed, or the user says stop |

### Commit Command

When user types `закоммить` or `commit`:

1. Analyze (parallel):
   ```bash
   git status              # Untracked files
   git diff                # Staged and unstaged changes
   git log --oneline -5    # Recent commits for style reference
   ```
2. Write the message: `<type>(<package>): <subject>`: imperative mood, no period, focus on "why".
3. Commit:
   ```bash
   git add <relevant-files>
   git commit -m "<type>(<package>): <subject>"
   git status  # Verify success
   ```

## Release Pipeline

**⛔ Commit order (dependencies first):**
```
1. @zumda/core    (domain, types, use cases)
2. @zumda/worker  (uses core)
3. @zumda/app     (uses core types, calls worker)
```

**Atomic commits (one module per commit, tests in the same commit):**
| Order | Scope | Example |
|-------|-------|---------|
| 1 | types | `feat(core): add Order type` |
| 2 | entity + tests | `feat(core): add Order entity` |
| 3 | use case + tests | `feat(core): add createOrder use case` |
| 4 | route + tests | `feat(worker): add order routes` |
| 5 | UI | `feat(app): add order flow` |

**⛔ RULES:**
- One module = one commit
- Each commit must pass all quality gates
- Never commit unfinished dependencies

**Quality Gates (before EACH commit):**
```bash
bun run format && bun run lint && bun run test && bun run build
```

**Release Steps (only when the user asks):**
1. Update `CHANGELOG.md` and `ROADMAP.md`
2. Bump `version` in the package's `package.json`
3. Tag: `git tag <package>-v<version>` and push the tag

## Deployment

**Stack:** Cloudflare Pages (Mini App) + Cloudflare Workers (API + bot webhook) + D1 + R2.
CI/CD: GitHub Actions. **⛔ Docker is PROHIBITED. No VPS.**

```
Telegram ─► Mini App (Pages: app., business., delivery.zumda.shop) ─► Worker (api.zumda.shop) ─► D1 / R2
Browser ─► business.zumda.shop (Telegram Login Widget) ─► Worker ─► D1 / R2
zumda.shop ─► Worker ─► 302 to t.me/zumdashop_bot (until the landing page)
Telegram Bot API ─► /tg/:botId, /tg/platform, /tg/business, /tg/courier ─► Worker
```

**Worker secrets:** `TOKEN_ENC_KEY`, `PLATFORM_BOT_TOKEN`, `PLATFORM_WEBHOOK_SECRET`, `PLATFORM_ADMIN_IDS`,
`COURIER_BOT_TOKEN`, `COURIER_WEBHOOK_SECRET`, `BUSINESS_BOT_TOKEN`, `BUSINESS_WEBHOOK_SECRET`,
`BUSINESS_SESSION_SECRET` (the webhook and session secrets are derived from the bot tokens by the
deploy).
**Worker vars:** `APP_ORIGIN` (`https://app.zumda.shop`), `BUSINESS_APP_ORIGIN`
(`https://business.zumda.shop`), `COURIER_APP_ORIGIN` (`https://delivery.zumda.shop`). The app
picks its mode by address (`business.`, `delivery.`), locally by `?mode=`.
**The bots' profiles are set by the deploy:** names «Zumda | Shop», «Zumda | Business»,
«Zumda | Kuryer», descriptions, commands (admins get theirs in Zumda | Business), menu buttons,
avatars (`brand/*-avatar.jpg`, set only when the file changed: its hash is in D1
`platform_settings`), the `/start` pictures (`brand/welcome/`). Only the Description Picture and
`/setdomain` are manual (no Bot API method).

- Addresses: `api.zumda.shop` and `zumda.shop` (Worker, Custom Domains); `app.`, `business.`,
  `delivery.zumda.shop` (one Pages project); the deploy adds them and their DNS records. The Worker has no workers.dev address.
- Checks run on the pull request (`static` and `unit` side by side, e2e on eight machines; the
  required checks are `quality-gates` and `e2e`). A push to `main` only deploys (~30 s): the
  `main` ruleset takes a PR only with green checks on code up to date with `main`.

## Package Documentation (MANDATORY)

| File | Purpose |
|------|---------|
| `ROADMAP.md` | Milestones, tasks with checkboxes |
| `CHANGELOG.md` | Version history |
| `TODO.md` | Technical debt (create when the first item appears) |

## Testing Checklist

- [ ] Shop setup (owner) + shop link
- [ ] Product catalog CRUD with photos
- [ ] Customer order placement (contact + location + landmark)
- [ ] Owner notification with buttons
- [ ] Order status updates → customer notification
- [ ] Money: card at checkout → «Я перевёл» → «Деньги пришли, принять» → one «Доставил»;
      cancel after paid → «Вернул»; a shop without a card takes no orders
- [ ] Courier invite → assign → picked up → delivered
- [ ] District delivery: invite → accept in the courier bot → join the network → an order of a
      point without couriers taken by a network courier → paid before cooking, no cash
- [ ] Water (a grocery store with the bottle deposit): empty bottles + deposit; reorder
- [ ] Service: «Xizmatlar», «Bajarilmoqda», «Bajarildi»
- [ ] Zumda | Business in a browser: sign in with Telegram, manage a business, sign out
- [ ] Grocery: weight items (kg steps); stop-list for today
- [ ] Each order stores channel + commission (0 for own bot)
- [ ] Service fee: a "Сервис" line in the cart, order and messages; 0 at rate 0; monthly per-shop report
- [ ] Cancel flow
- [ ] Uzbek texts only (no Cyrillic in any dictionary); light app in a dark Telegram
- [ ] Many cards: add, switch the payment card, old orders keep their card
- [ ] Empty states handling

## Release Checklist

- [ ] Quality gates pass (format, lint 0/0, test, build)
- [ ] CHANGELOG.md updated
- [ ] ROADMAP.md updated
- [ ] Version bumped in package.json

---

## Quick Reference

```
MUST: Return types | await promises | const | curly braces | ===
NEVER: any | console.log | floating promises | var | secrets in code | Docker | em dash
NEVER: frontend → DB directly | prices or customerId from client
LIMITS: 5 params | 100 lines | 4 depth | 15 complexity
STACK: Cloudflare Pages + Workers (Hono) + D1 + R2 | React + Vite | Telegram Bot API
GATES: bun run format → bun run lint → bun run test → bun run build
```
