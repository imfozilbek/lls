# CLAUDE.md

> **ALL RULES ARE MANDATORY. Zero tolerance for violations.**

## Session Start

1. Read `./ROADMAP.md` to understand current status.
2. If ROADMAP.md conflicts with this file, **this file wins**.

The old NestJS + MongoDB code is kept only at git tag `legacy-v0`. Reuse ideas from it, never its bugs.

## Project Overview

LLS (LocalLoopSolutions) — local delivery platform for small businesses.
TypeScript monorepo (Bun workspaces). Bun 1.3.

**Target market:** small businesses in regions and districts of Uzbekistan, where
Yandex Eats / Uzum and other aggregators do not operate. The goal is to own these small markets:
first every shop gets its own bot, then all their products join one LLS marketplace.

| Package | Description |
|---------|-------------|
| `@lls/core` | Domain logic (DDD): entities, value objects, use cases, ports. Pure TS, no deps |
| `@lls/worker` | Cloudflare Worker: HTTP API (Hono) + Telegram bot webhooks |
| `@lls/app` | Telegram Mini App (React), hosted on Pages: customer storefront, owner section "Мой магазин", courier section, shop onboarding |

## White-Label Model

LLS is the platform brand. Customers see the **shop's brand**; the app shows a small "powered by LLS".

- **One bot per shop.** The owner creates it in BotFather. The chat, name and avatar are the shop's.
- **Platform bot (LLS).** Owners connect their shop through it (self-serve onboarding).
  Platform admins (`PLATFORM_ADMIN_IDS`) approve new shops with a button.
- **One Worker serves all bots:** webhook `/tg/:botId` for shop bots, `/tg/platform` for the LLS bot.
- **One Mini App for all shops.** The shop bot's menu button opens it with `?shop=<slug>`.
- **Per-shop branding:** name, logo, brand color. Everything else is shared.

## Product Stages

| Stage | What | Revenue |
|-------|------|---------|
| **1. Own bot per business (NOW)** | Storefront + orders + notifications. The shop delivers with **its own couriers**. **LLS showcase**: search across shops in the LLS bot, the order goes to one shop | Subscription + commission on showcase orders |
| 2. District marketplace | One cart from several shops, district filter | Commission on marketplace sales only |
| 3. Shared delivery | Shared courier pool, several pickups per trip | Delivery fee + volume terms |

**Pilot:** three shops at once — food, water, grocery. Each has its own bot.

**Money rule of the platform:** LLS takes a commission **only** on sales made through the LLS
marketplace channel. Sales through a shop's own bot are the shop's business (a separate
subscription deal); the system never takes a cut there.

**⛔ RULES:**
- Build ONLY stage 1 now. The LLS showcase is in: search across shops + shop list in the LLS bot;
  a tap opens that shop's storefront inside the LLS bot; cart and order stay per shop.
  No shared cart, shared courier pool, routing, settlements or payouts.
- Only shops with a marketplace deal (`business.marketplace`) appear in the showcase. A platform
  admin sets the deal in the LLS bot: `/market <slug> <percent>` or `/market <slug> off`.
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
  - couriers belong to one business now (`business_id`); stage 3 adds a shared pool on top

## SLC Rules (MANDATORY)

**⛔ SLC, NOT MVP.** We build **SLC (Simple, Lovable, Complete)**:
- **Simple** — easy to use, no unnecessary complexity
- **Lovable** — delightful UX, polished design
- **Complete** — fully working, no "coming soon" placeholders

| Rule | Requirement |
|------|-------------|
| **v1.0 scope** | Stage 1: orders, status tracking, shop couriers, vertical toggles |
| **Quality** | Must be PERFECT, not "good enough" |
| **No scope creep** | Shared cart, shared courier pool, multi-city, online payments — NOT in v1.0 |
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
- Silent failures — always report errors
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
- If error repeats twice — rule MUST be updated
- Never ignore systematic errors
- Fix the root cause, not symptoms

## No Laziness (MANDATORY)

**Claude MUST complete tasks fully:**

| Rule | Requirement |
|------|-------------|
| **Context limits** | IGNORE — autocompact handles it |
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
bun run --filter @lls/core build               # Build specific package
bunx wrangler dev                              # Run Worker locally (in packages/worker)
bunx wrangler d1 migrations apply lls --local  # Apply D1 migrations locally (default)
bunx wrangler d1 migrations apply lls --remote # Apply D1 migrations in production
bunx wrangler types                            # Regenerate Env types after wrangler.jsonc changes
bunx wrangler deploy                           # Deploy Worker
```

## Architecture (DDD + Clean Architecture)

```
Domain (inner)     → Entities, Value Objects, Errors — NO framework imports
Application        → Use Cases, Ports (interfaces), DTOs
Infrastructure     → Routes, Repositories, Adapters (@lls/worker)
```

**RULES:**
- Domain NEVER imports from outer layers
- Entities have behavior, not just data
- Value Objects are immutable
- API returns DTOs, not entities
- No magic numbers/strings
- No hardcoded secrets

## Worker Architecture (@lls/worker)

```
src/
├── index.ts          # Worker entry
├── app.ts            # Hono app: CORS, /health, /api, /img, /tg
├── env.ts            # Bindings (DB, BUCKET) + secrets
├── crypto.ts         # initData HMAC check, AES-GCM for bot tokens
├── auth.ts           # X-Shop → shop's bot token → verify initData → user + role (owner/courier/customer)
├── services.ts       # Wires repositories, gateway and use cases
├── http/             # Error mapping, zod schemas, image upload
├── routes/           # customer, owner, courier, platform, image, webhook
├── repositories/     # D1 implementations of @lls/core ports
└── telegram/         # Bot API gateway, texts (uz/ru, per business type), notifier
scripts/              # Local dev only: seed-dev.ts, sign-init-data.ts
wrangler.jsonc        # Bindings: DB (D1), BUCKET (R2), vars; run `wrangler types` after changes
migrations/           # D1 SQL migrations
```
No cron: add `scheduled()` only when a real client needs a timed job.
```
```

**Worker Rules:**
- Worker is a thin layer. Business logic lives in `@lls/core` use cases.
- Every body, query and param is validated with zod.
- Identity (customer, owner, courier) comes ONLY from verified Telegram data, never from the request body.
- Check ownership on every route that reads or changes business-owned data.
- DomainError → HTTP: validation 400, unauthorized 401, forbidden 403, not found 404,
  conflict / invalid status transition 409, business rule 422.
- Frameworks: Hono + zod only. No NestJS, no Express, no ORM.

## Domain Models

| Entity | Key Fields |
|--------|------------|
| Business | id, slug, name, type (food/water/grocery), owner_telegram_id, status (pending/active/disabled), bot (id, username, encrypted token, webhook secret), brand (color, logo_key), location, address, delivery (radius, fee, free_from, min_order), working_hours, features, accepting_orders, bottle_deposit, marketplace (commission rate, joined_at) or none |
| Product | id, business_id, name, description, price (integer UZS per unit), unit, step (grams for kg), category (shared taxonomy), image_key, is_available, unavailable_until (stop-list for today), returnable (19 l bottle) |
| Customer | id, telegram_id (global, unique), name, phone (from Telegram contact), language |
| CustomerBusiness | customer_id, business_id, first_order_at — whose customer this is |
| Courier | id, business_id, telegram_id, name, phone, is_active — the shop's own delivery person |
| Order | id, business_id, number (per shop), customer_id, channel, items (name + unit + category + price + total snapshot), subtotal, delivery_fee, deposit_total, bottles_returned, total, commission (rate + amount), status, courier, address, location, landmark, comment, cancel_reason |

**Money:** integer UZS. Never floats. Quantities are integers too: pieces, or **grams** for `kg`
items; line total = `round(price × grams / 1000)`.

**Order Status Flow (single source of truth: `@lls/core` enum):**
```
pending → accepted → preparing → ready → picked_up → delivered
    ↓         ↓          ↓         ↓         ↓
cancelled  cancelled  cancelled  cancelled  cancelled
```
- `pending → ready` = shop part. `picked_up → delivered` = delivery part.
- Owner moves every step and may cancel. The assigned courier moves only
  `ready → picked_up → delivered` and never cancels. The customer cancels only while `pending`.
- The owner assigns a courier (`accepted`…`ready`); without couriers the owner delivers.
- Only ONE transitions table (and one actor rule next to it) in the codebase.

## Database (Cloudflare D1)

**⛔ D1 is the only database. No MongoDB, Redis, Postgres or others without an explicit decision.**

**D1 (SQLite):**
```typescript
// Schema changes ONLY via SQL migrations: packages/worker/migrations/*.sql
// Always: parameterized queries — db.prepare(sql).bind(...)
// Always: index every WHERE / ORDER BY column (free tier counts ROWS READ, not queries)
// Index: business_id, customer_id, status, created_at, telegram_id, slug
// Multi-statement writes: db.batch([...]) (runs as one transaction)
// Money: INTEGER (UZS). Timestamps: INTEGER (unix ms), UTC
```

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
No `X-Shop` → verify with the platform bot token (onboarding, showcase search).
`X-Shop` + `X-Via: marketplace` → verify with the **platform** bot token; the shop must be active
and in the marketplace. The token that verified the signature decides the order channel
(`shop_bot` or `marketplace`); the client can never choose it.

**Bot tokens:** stored in D1 encrypted with AES-GCM (key: secret `TOKEN_ENC_KEY`). Never logged,
never returned by the API. Validate a new token with `getMe` before saving.

**Roles** (per shop, one app, one auth): `customer` (default), `owner`
(`business.owner_telegram_id`), `courier` (active row in `couriers` for this shop).
Through the showcase (`X-Via: marketplace`) the role is always `customer`.

**Entry:** the shop bot's menu button opens `?shop=<slug>`. Couriers get a button to
`?shop=<slug>&mode=courier`. Onboarding: the platform bot opens `?mode=onboarding`.
Showcase: the platform bot opens `?mode=market`.

**Courier invite:** the owner creates a one-time link `t.me/<shop_bot>?start=c_<code>` (48 h).
`/start c_<code>` in the shop bot makes the sender a courier of that shop.

**Notifications (no WebSockets):**
- New order → message to the owner with a button for the **next allowed status** + "Отменить".
- Courier assigned → order card to the courier (address, landmark, map, phone, cash to collect,
  empty bottles) with "Забрал" / "Доставил".
- Status change → message to the customer (courier name, never the courier's phone). Showcase
  orders: the LLS bot writes to the customer (with the shop name); owner and courier still get
  messages from the shop bot.
- Texts depend on the business type (food: «Меню», «Готовится»; water/grocery: «Каталог», «Собираем»).
- Before the first order, the app calls `requestWriteAccess()` so the shop bot may message the customer.
- Phone: `requestContact()` → Telegram sends a `contact` message to the bot that opened the app
  (shop bot or LLS bot) → save it only if `contact.user_id === from.id`.

**Regional UX (required):**
- Languages: Uzbek (Latin) + Russian. Simple dictionary, no heavy i18n library
- Address: Telegram location + "ориентир" (landmark) field
- Phone: Telegram "share contact" button, never typed by hand
- Payment: cash on delivery (online payments later)

**User Flow:**
- Customer: Open shop link → Browse → Cart → Order → Track
- Showcase customer: LLS bot → Search → Shop → Cart → Order → Track
- Owner: New order message → Accept → Next status → assign courier; catalog and couriers in "Мой магазин"
- Courier: Invite link → Start → assigned order card → Picked up → Delivered

## Security (MANDATORY)

**FORBIDDEN:**
```typescript
eval(userInput)                        // Code injection
new Function(userInput)                // Code injection
document.innerHTML = x                 // XSS
`SELECT ... WHERE id = ${userInput}`   // SQL injection — use D1 .bind()
```

**REQUIRED:**
- Secrets: `wrangler secret put` in prod, `.dev.vars` locally (never committed)
- Validate all inputs with zod (especially Telegram data)
- Never log passwords/tokens/secrets
- Verify Telegram initData on every request
- Prices, totals and `customerId` are computed on the server. Never trust them from the client
- Check ownership on every route (owner edits only own shop, customer sees only own orders)
- Frontend NEVER talks to D1/R2 directly. Only through the Worker
- CORS: allow only `APP_ORIGIN` (the Pages address)
- Check `git diff` before commit

## Performance (MANDATORY)

| Metric | Limit |
|--------|-------|
| API response | < 200ms (p95) |
| DB query | < 100ms |
| Worker CPU | < 10ms per request |
| Worker memory | < 128MB |
| Mini App initial JS | ≤ 100 KB gzip (regional mobile internet is slow) |

**AVOID:**
- N+1 queries — use JOIN or `db.batch`
- Missing indexes
- `SELECT *` — select needed columns
- No pagination
- Heavy libraries in the Worker or the customer bundle

## Free Tier Limits

| Service | Free limit | Upgrade when |
|---------|-----------|--------------|
| Workers | 100,000 requests/day, 10 ms CPU/request, 50 subrequests/request | > 70k requests/day → Workers Paid ($5/mo) |
| D1 | 500 MB per database, 5M rows read/day, 100k rows written/day, 7-day Time Travel | DB > 400 MB or reads near limit |
| R2 | 10 GB storage, free egress | > 8 GB |
| Pages | Static hosting, `*.pages.dev` | Not needed |
| Cron Triggers | 5 per account | — |

**⛔ Design to stay free:** no polling faster than 15 s, paginate lists, index queries.

## Code Style (MANDATORY)

```
4 spaces | no semicolons | double quotes | 100 chars max | trailing commas
```

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
| `max-params` | Max 5. Need more — pass one object |
| `max-lines-per-function` | Max 100 |
| `complexity` | Max 15 |
| `max-depth` | Max 4 |

## Forbidden Patterns

```typescript
any                    // Use proper type
as any                 // Fix the type
// @ts-ignore          // Fix the error
x!.y                   // Non-null assertion — use a null check
var                    // Use const/let
==                     // Use ===
console.log            // Use logger
```

## Import Order

```typescript
// 1. Built-ins
// 2. External packages
// 3. @lls/* packages
// 4. Relative (parent first)
// 5. Type-only imports
```

## UI Development (MANDATORY)

**⛔ WORKFLOW for any UI task:**
1. Read `.skills/brand-guidelines/SKILL.md` first
2. Plan screens with animations and micro-interactions
3. Result must NOT look "AI-generated" — must feel human-crafted

**UI Stack:**
| Task | Stack |
|------|-------|
| Mini App (customer + owner) | React + Vite + Tailwind, Telegram theme variables + brand tokens |
| Font | System font (per brand guidelines): 0 KB, native look in Telegram |
| Animations | CSS transitions/keyframes with custom easing and timing. Motion library only where CSS is not enough |
| Owner section ("Мой магазин") | Same Mini App, lazy-loaded chunk (customers never download it) |

**⛔ FORBIDDEN:**
- Arbitrary colors — only brand palette and Telegram theme variables
- Interactive elements without pressed (`active`) and focus states
- Hardcoded light colors that break Telegram dark theme

**REQUIRED:**
- Micro-interactions on all interactive elements
- Personality: custom icons and empty states with character (no stock illustrations)

## Skills Usage (MANDATORY)

| Skill | When to Use | Status |
|-------|-------------|--------|
| `brand-guidelines` | Before any UI work — colors, typography, spacing | In repo: `.skills/brand-guidelines/` |
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
- `@lls/core`, `@lls/app`: plain Vitest (node environment).
- `@lls/worker`: `@cloudflare/vitest-plugin` — tests run in workerd with real D1; migrations are
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
2. Write the message: `<type>(<package>): <subject>` — imperative mood, no period, focus on "why".
3. Commit:
   ```bash
   git add <relevant-files>
   git commit -m "<type>(<package>): <subject>"
   git status  # Verify success
   ```

## Release Pipeline

**⛔ Commit order (dependencies first):**
```
1. @lls/core    (domain, types, use cases)
2. @lls/worker  (uses core)
3. @lls/app     (uses core types, calls worker)
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
Telegram ─► Mini App (Pages, *.pages.dev) ─► Worker (*.workers.dev, /api) ─► D1 / R2
Telegram Bot API ─► /tg/:botId, /tg/platform ─► Worker
```

**Worker secrets:** `TOKEN_ENC_KEY`, `PLATFORM_BOT_TOKEN`, `PLATFORM_WEBHOOK_SECRET`, `PLATFORM_ADMIN_IDS`.
**Worker vars:** `APP_ORIGIN` (Pages URL).

- Custom domain: later, optional.
- Deploy only after quality gates pass on `main`.

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
- [ ] Courier invite → assign → picked up → delivered
- [ ] Water: empty bottles + deposit; reorder
- [ ] Grocery: weight items (kg steps); stop-list for today
- [ ] Each order stores channel + commission (0 for own bot)
- [ ] Cancel flow
- [ ] Uzbek + Russian texts
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
NEVER: any | console.log | floating promises | var | secrets in code | Docker
NEVER: frontend → DB directly | prices or customerId from client
LIMITS: 5 params | 100 lines | 4 depth | 15 complexity
STACK: Cloudflare Pages + Workers (Hono) + D1 + R2 | React + Vite | Telegram Bot API
GATES: bun run format → bun run lint → bun run test → bun run build
```
