# CLAUDE.md

> **ALL RULES ARE MANDATORY. Zero tolerance for violations.**

## Session Start

1. Read `./ROADMAP.md` to understand current status.
2. If ROADMAP.md conflicts with this file, **this file wins** (see Migration Status).

## Migration Status (READ FIRST)

The code is being migrated from the old stack to the stack described in this file.

| Old (being removed) | New |
|---------------------|-----|
| `@lls/api` — NestJS + Fastify + MongoDB + Redis + socket.io | `@lls/worker` — Hono + D1 |
| `@lls/bot` + `@lls/admin` — two React apps | `@lls/app` — one Mini App |
| VPS + PM2 + Nginx + Gitea CI | Cloudflare Pages + Workers + GitHub Actions |

**RULES:**
- Do NOT add features to `@lls/api`, `@lls/bot`, `@lls/admin`. Only move code out of them.
- Delete an old package only after its replacement works.
- `@lls/core` stays. Prune unused parts, fix bugs, reuse the rest.

## Project Overview

LLS (LocalLoopSolutions) — local delivery platform for small businesses.
TypeScript monorepo (Bun workspaces). Bun >= 1.2.4.

**Target market:** small businesses in regions and districts of Uzbekistan, where
Yandex Eats / Uzum and other aggregators do not operate.

| Package | Description |
|---------|-------------|
| `@lls/core` | Domain logic (DDD): entities, value objects, use cases, ports. Pure TS, no deps |
| `@lls/worker` | Cloudflare Worker: HTTP API (Hono) + Telegram bot webhook + cron |
| `@lls/app` | Telegram Mini App (React), hosted on Pages: customer storefront, owner section "Мой магазин", shop onboarding |

**Root:** `/Users/fozilbeksamiyev/projects/lls`

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
| **1. Own bot per business (NOW)** | Storefront + orders + owner notifications. Business delivers itself | Subscription |
| 2. District marketplace | One Mini App, one cart from several shops, search across shops | Small commission + subscription |
| 3. Own delivery | Shared couriers, several pickups per trip | Delivery fee + volume terms |

**Pilot order:** food → water → grocery.

**⛔ RULES:**
- Build ONLY stage 1 now. No shared cart, courier pool, routing, settlements.
- One universal core for all business types. Vertical specifics = feature toggles per business
  (e.g. `reorder`, `bottleDeposit`, `stopList`, `weightItems`).
- Add a feature only when a real client asks for it.
- Design stage 1 so stages 2–3 need no rewrite:
  - multi-tenant: `business_id` in every business-owned table
  - one global customer per `telegram_id` + customer↔business link
  - shared category taxonomy + units (шт, кг, л, 19 л)
  - geo: business location + delivery zone, customer location

## SLC Rules (MANDATORY)

**⛔ SLC, NOT MVP.** We build **SLC (Simple, Lovable, Complete)**:
- **Simple** — easy to use, no unnecessary complexity
- **Lovable** — delightful UX, polished design
- **Complete** — fully working, no "coming soon" placeholders

| Rule | Requirement |
|------|-------------|
| **v1.0 scope** | Stage 1: order flow + status tracking ONLY |
| **Quality** | Must be PERFECT, not "good enough" |
| **No scope creep** | Marketplace, couriers, multi-city, online payments — NOT in v1.0 |
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
├── index.ts          # Hono app: routes + webhook + scheduled() for cron
├── env.ts            # Bindings (DB, BUCKET) + secrets, validated with zod
├── crypto.ts         # initData HMAC check, AES-GCM for bot tokens
├── auth.ts           # X-Shop → shop's bot token → verify initData → current user + role
├── routes/           # HTTP routes, one file per feature (shop, product, order, me, owner, platform)
├── repositories/     # D1 implementations of @lls/core ports
├── telegram/         # Bot API gateway, webhooks (shop + platform), notifications
└── cron.ts           # Scheduled jobs (only when a real client needs one)
wrangler.jsonc        # Bindings: DB (D1), BUCKET (R2), vars; run `wrangler types` after changes
migrations/           # D1 SQL migrations
```

**Worker Rules:**
- Worker is a thin layer. Business logic lives in `@lls/core` use cases.
- Every body, query and param is validated with zod.
- Identity (customer, owner) comes ONLY from verified Telegram data, never from the request body.
- Check ownership on every route that reads or changes business-owned data.
- DomainError → HTTP: validation 400, forbidden 403, not found 404, business rule 422.
- Frameworks: Hono + zod only. No NestJS, no Express, no ORM.

## Domain Models

| Entity | Key Fields |
|--------|------------|
| Business | id, slug, name, type (food/water/grocery), owner_telegram_id, status (pending/active/disabled), bot (id, username, encrypted token, webhook secret), brand (color, logo_key), location, address, delivery (radius, fee, free_from, min_order), working_hours, features, accepting_orders |
| Product | id, business_id, name, price (integer UZS), unit, category (shared taxonomy), image_key, is_available |
| Customer | id, telegram_id (global, unique), name, phone (from Telegram contact), language |
| CustomerBusiness | customer_id, business_id, first_order_at — whose customer this is |
| Order | id, business_id, number (per shop), customer_id, items (name + unit + price snapshot), subtotal, delivery_fee, total, status, address, location, landmark, comment, cancel_reason |

**Money:** integer UZS. Never floats.

**Order Status Flow (single source of truth: `@lls/core` enum):**
```
pending → accepted → preparing → ready → picked_up → delivered
    ↓         ↓          ↓         ↓         ↓
cancelled  cancelled  cancelled  cancelled  cancelled
```
- `pending → ready` = business part. `picked_up → delivered` = delivery part.
- Stage 1: the owner moves all statuses. Stage 3: the delivery part moves to a `Delivery` entity.
- Only ONE transitions table in the codebase.

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

**Error response (always):** `{ error: { code, message } }`

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
No `X-Shop` → verify with the platform bot token (onboarding only).

**Bot tokens:** stored in D1 encrypted with AES-GCM (key: secret `TOKEN_ENC_KEY`). Never logged,
never returned by the API. Validate a new token with `getMe` before saving.

**Roles:** `customer` (default) and `owner` (`business.owner_telegram_id`). One app, one auth.

**Entry:** `t.me/<bot>?startapp=shop_<slug>` opens the shop storefront.

**Notifications (no WebSockets):**
- New order → message to the owner with a button for the **next allowed status** + "Отменить".
- Status change → message to the customer.
- Before the first order, the app calls `requestWriteAccess()` so the shop bot may message the customer.
- Phone: `requestContact()` → Telegram sends a `contact` message to the shop bot webhook →
  save it only if `contact.user_id === from.id`.

**Regional UX (required):**
- Languages: Uzbek (Latin) + Russian. Simple dictionary, no heavy i18n library
- Address: Telegram location + "ориентир" (landmark) field
- Phone: Telegram "share contact" button, never typed by hand
- Payment: cash on delivery (online payments later)

**User Flow:**
- Customer: Open shop link → Browse → Cart → Order → Track
- Owner: New order message → Accept → Next status; catalog in "Мой магазин"

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
- Personality: illustrations, custom icons, empty states with character

## Skills Usage (MANDATORY)

| Skill | When to Use | Status |
|-------|-------------|--------|
| `brand-guidelines` | Before any UI work — colors, typography, spacing | In repo: `.skills/brand-guidelines/` |
| `software-architecture` | New features, refactoring, architecture decisions | Use if installed |
| `test-driven-development` | Writing or updating tests | Use if installed |

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

Measure with `vitest run --coverage` (`@vitest/coverage-v8`).

## Git Commits

```
<type>(<package>): <subject>
feat(worker): add order routes
fix(app): resolve cart issue
docs: update roadmap              # no package for repo-wide changes
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

**⛔ NEVER add Co-Authored-By or a Claude Code footer.**

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
NEVER: frontend → DB directly | prices or customerId from client | new features in old packages
LIMITS: 5 params | 100 lines | 4 depth | 15 complexity
STACK: Cloudflare Pages + Workers (Hono) + D1 + R2 | React + Vite | Telegram Bot API
GATES: bun run format → bun run lint → bun run test → bun run build
```
