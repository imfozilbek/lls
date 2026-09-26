# CLAUDE.md

> **ALL RULES ARE MANDATORY. Zero tolerance for violations.**

## Task Workflow (MANDATORY)

**⛔ SLC, NOT MVP!** We don't build MVPs. We follow **SLC (Simple, Lovable, Complete)**:
- **Simple** — Easy to use, no unnecessary complexity
- **Lovable** — Delightful UX, polished design, feels premium
- **Complete** — Fully functional, no "coming soon" placeholders

**⛔ MUST enter planning mode before starting ANY new task.**

| Rule | Requirement |
|------|-------------|
| **New tasks** | Always use `EnterPlanMode` tool first |
| **Purpose** | Plan implementation steps before writing code |
| **Exit** | Use `ExitPlanMode` only after plan is approved |

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
| 1 | Check uncommitted changes (git status, git diff) |
| 2 | Commit and release changes |
| 3 | Review git log for last 12 hours |
| 4 | Show summary: what done, progress achieved |

## Skills Usage (MANDATORY)

| Skill | When to Use |
|-------|-------------|
| `brand-guidelines` | Before any UI/frontend work — read colors, fonts, spacing |
| `frontend-design` | Creating UI components, pages, layouts |
| `software-architecture` | New features, refactoring, architecture decisions |
| `test-driven-development` | Writing tests, TDD workflow |

**⛔ RULES:**
- Always read `.skills/brand-guidelines/SKILL.md` before frontend development
- Use `frontend-design` skill for production-grade UI components
- Follow brand palette strictly — no arbitrary colors
- Use `software-architecture` for DDD, Clean Architecture, SOLID, KISS, DRY, YAGNI
- Use `test-driven-development` when writing or updating tests
- Invoke skills proactively, don't wait for user to ask

**Auto-install if not available:**
```bash
/plugin marketplace add NeoLabHQ/context-engineering-kit
/plugin install ddd@NeoLabHQ/context-engineering-kit
/plugin install tdd@NeoLabHQ/context-engineering-kit
```

## UI Development (MANDATORY)

**Principle: SLC (Simple, Lovable, Complete)** — Every UI must be simple to use, lovable in design, complete in functionality.

**⛔ WORKFLOW for any UI task:**
1. Read `.skills/brand-guidelines/SKILL.md` first
2. Invoke `frontend-design` skill
3. Plan with animations and micro-interactions
4. Result must NOT look "AI-generated" — must feel human-crafted

**UI Stack (by task type):**
| Task | Stack |
|------|-------|
| Mini App (customer + owner) | React + Vite + Tailwind, Telegram theme variables + brand tokens |
| Animations in Mini App | CSS transitions/keyframes first; Motion only where CSS is not enough |
| Owner section ("Мой магазин") | Same Mini App, lazy-loaded chunk (customers never download it) |
| Future marketing site (stage 2) | Astro; Aceternity UI / Magic UI allowed there |

**Bundle budget (Mini App):** initial customer JS ≤ 100 KB gzip. Regional mobile internet is slow.

**⛔ FORBIDDEN (generic AI look):**
- Default shadcn/ui without customization
- System fonts only (use brand fonts)
- No hover/focus states
- Symmetric/centered everything
- No micro-interactions

**REQUIRED for unique design:**
- Custom animations (not default transitions)
- Brand typography from guidelines
- Asymmetric layouts where appropriate
- Personality (illustrations, custom icons)
- Micro-interactions on all interactive elements

## Project Overview

LLS (LocalLoopSolutions) — Local delivery platform for small businesses. TypeScript monorepo (Bun workspaces). Bun >= 1.2.4.

**Target market:** small businesses in regions and districts of Uzbekistan, where
Yandex Eats / Uzum and other aggregators do not operate.

| Package | Description |
|---------|-------------|
| `@lls/core` | Domain logic (DDD): entities, value objects, use cases, ports. Pure TS, no deps |
| `@lls/worker` | Cloudflare Worker: HTTP API (Hono) + Telegram bot webhook + cron |
| `@lls/app` | Telegram Mini App (React): customer storefront + owner section "Мой магазин" |

**Root:** `/Users/fozilbeksamiyev/projects/lls`

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

## Product Stages

| Stage | What | Revenue |
|-------|------|---------|
| **1. Own bot per business (NOW)** | Storefront + orders + owner notifications. Business delivers itself | Subscription |
| 2. District marketplace | One Mini App, one cart from several shops, search across shops | Small commission + subscription |
| 3. Own delivery | Shared couriers, several pickups per trip | Delivery fee + volume terms |

**Pilot:** food business first, then water, then grocery.

**⛔ RULES:**
- Build ONLY stage 1 now. No shared cart, courier pool, routing, settlements.
- Universal core for all business types. Vertical specifics = feature toggles per business
  (e.g. `reorder`, `bottleDeposit`, `stopList`, `weightItems`).
- Add a feature only when a real client asks for it.
- Design stage 1 so stages 2–3 need no rewrite:
  - multi-tenant: `business_id` in every business-owned table
  - one global customer per `telegram_id` + customer↔business link
  - shared category taxonomy + units (шт, кг, л, 19 л)
  - geo: business location + delivery zone, customer location
  - two status levels: order (business) and delivery

## Commands

```bash
bun run build                                  # Build all
bun run test                                   # Test all
bun run format                                 # Format (4 spaces)
bun run lint                                   # Lint (0 errors, 0 warnings)
bun run dev                                    # Dev mode
bun run --filter @lls/core build               # Build specific package
bunx wrangler dev                              # Run Worker locally (in packages/worker)
bunx wrangler d1 migrations apply lls --local  # Apply D1 migrations locally
bunx wrangler deploy                           # Deploy Worker
```

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
| `no-console` | Use `.warn` or `.error` only |
| `max-params` | Max 5 (8 for DDD) |
| `max-lines-per-function` | Max 100 |
| `complexity` | Max 15 |
| `max-depth` | Max 4 |

## Architecture (DDD + Clean Architecture)

```
Domain (inner)     → Entities, Value Objects, Events — NO framework imports
Application        → Use Cases, Ports (interfaces)
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
├── auth.ts           # Telegram initData check → current user + role
├── routes/           # HTTP routes, one file per feature (shop, product, order, customer)
├── repositories/     # D1 implementations of @lls/core ports
├── telegram/         # Bot API client, webhook handler, owner notifications
└── cron.ts           # Scheduled jobs (reminders)
```

**Worker Rules:**
- Worker is a thin layer. Business logic lives in `@lls/core` use cases.
- Every body, query and param is validated with zod.
- Identity (customer, owner) comes ONLY from verified initData, never from the request body.
- Check ownership on every route that reads or changes business-owned data.
- DomainError → HTTP: validation 400, not found 404, business rule 422, forbidden 403.
- Frameworks: Hono + zod only. No NestJS, no Express, no ORM.

## Domain Models

| Entity | Key Fields |
|--------|------------|
| Business | id, slug, name, type (food/water/grocery/…), owner_telegram_id, location, delivery_zone, working_hours, features, is_active |
| Product | id, business_id, name, price (integer UZS), unit, category (shared taxonomy), image_key, is_available |
| Customer | id, telegram_id (global, unique), name, phone (from Telegram contact), language |
| CustomerBusiness | customer_id, business_id, first_order_at — whose customer this is |
| Order | id, business_id, customer_id, items (name + price snapshot), delivery_fee, total, status, delivery_status, address, location, landmark |

**Money:** integer UZS. Never floats.

**Order Status Flow (single source of truth: `@lls/core` enum):**
```
pending → accepted → preparing → ready → picked_up → delivered
    ↓         ↓          ↓         ↓         ↓
cancelled  cancelled  cancelled  cancelled  cancelled
```
- Stage 1: the owner moves all statuses (from bot buttons or the owner section).
- Only ONE transitions table in the codebase.

## Git Commits

```
<type>(<package>): <subject>
feat(worker): add order routes
fix(app): resolve cart issue
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

**DO NOT add Claude Code footer or Co-Authored-By**

## Commit Command

When user types `закоммить` or `commit`:

### 1. Analyze (parallel)
```bash
git status              # Untracked files
git diff                # Staged and unstaged changes
git log --oneline -5    # Recent commits for style reference
```

### 2. Create commit message
```
<type>(<package>): <subject>
```
- Subject: concise, imperative mood, no period
- Focus on "why" not "what"

### 3. Commit
```bash
git add <relevant-files>
git commit -m "<type>(<package>): <subject>"
git status  # Verify success
```

**NEVER add Co-Authored-By or Claude Code footer.**

## Release Pipeline

**⛔ Commit Order (dependencies first):**
```
1. @lls/core    (domain, types, use cases)
2. @lls/worker  (uses core)
3. @lls/app     (uses core types, calls worker)
```

**Atomic Commits (one per module):**
| Order | Scope | Example |
|-------|-------|---------|
| 1 | types | `feat(core): add Order type` |
| 2 | entity | `feat(core): add Order entity` |
| 3 | use case | `feat(core): add createOrder use case` |
| 4 | route | `feat(worker): add order routes` |
| 5 | UI | `feat(app): add order flow` |
| 6 | tests | `test(core): add Order tests` |

**⛔ RULES:**
- One module = one commit
- Each commit must pass all quality gates
- Never commit unfinished dependencies
- Commit order: types → entities → use cases → routes → UI

**Quality Gates (before EACH commit):**
```bash
bun run format && bun run lint && bun run test
```

**Release Steps:**
```bash
# 1. Update CHANGELOG.md, ROADMAP.md
# 2. Version & tag
npm version minor
git tag <package>-v<version>
git push origin main --tags
```

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
- Check `git diff` before commit

## Testing (MANDATORY)

| Layer | Min Coverage |
|-------|--------------|
| Domain | 90% |
| Use Cases | 80% |
| Routes | 70% |

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

## Free Tier Limits

| Service | Free limit | Upgrade when |
|---------|-----------|--------------|
| Workers | 100,000 requests/day, 10 ms CPU/request, 50 subrequests/request | > 70k requests/day → Workers Paid ($5/mo) |
| D1 | 500 MB per database, 5M rows read/day, 100k rows written/day, 7-day Time Travel | DB > 400 MB or reads near limit |
| R2 | 10 GB storage, free egress | > 8 GB |
| Pages | Static hosting, `*.pages.dev` | Not needed |
| Cron Triggers | 5 per account | — |

**⛔ Design to stay free:** no polling faster than 15 s, paginate lists, index queries.

## Performance (MANDATORY)

| Metric | Limit |
|--------|-------|
| API response | < 200ms (p95) |
| DB query | < 100ms |
| Worker CPU | < 10ms per request |
| Worker memory | < 128MB |
| Mini App initial JS | ≤ 100 KB gzip |

**AVOID:**
- N+1 queries — use JOIN or `db.batch`
- Missing indexes
- `SELECT *` — select needed columns
- No pagination
- Heavy libraries in the Worker or the customer bundle

## API Design

| Action | Method | Path | Status |
|--------|--------|------|--------|
| List | GET | `/resources` | 200 |
| Get | GET | `/resources/:id` | 200/404 |
| Create | POST | `/resources` | 201 |
| Update | PATCH | `/resources/:id` | 200/404 |
| Delete | DELETE | `/resources/:id` | 204/404 |

## Telegram Mini App

**Validation:**
```typescript
// ALWAYS validate initData on the Worker with WebCrypto:
//   secret = HMAC_SHA256(key="WebAppData", msg=bot_token)
//   hash   = HMAC_SHA256(key=secret, msg=sorted "key=value" lines joined by "\n")
// Constant-time compare. Reject auth_date older than 24h or in the future
// Never trust client-side data without validation
```

**Roles:** `customer` (default) and `owner` (`business.owner_telegram_id`). One app, one auth.

**Entry:** `t.me/<bot>?startapp=shop_<slug>` opens the shop storefront.

**Owner notifications:** new order → bot message with inline buttons
(Принять / Готовится / В пути / Доставлен / Отменить). Status change → message to the customer.
No WebSockets.

**Regional UX (required):**
- Languages: Uzbek (Latin) + Russian. Simple dictionary, no heavy i18n library
- Address: Telegram location + "ориентир" (landmark) field
- Phone: Telegram "share contact" button, never typed by hand
- Payment: cash on delivery (online payments later)

**User Flow:**
- Customer: Open shop link → Browse → Cart → Order → Track
- Owner: New order message → Accept → Update status; catalog in "Мой магазин"

## Import Order

```typescript
// 1. Node built-ins
// 2. External packages
// 3. @lls/* packages
// 4. Relative (parent first)
// 5. Type-only imports
```

## Forbidden Patterns

```typescript
any                    // Use proper type
as any                 // Fix the type
// @ts-ignore          // Fix the error
!.                     // Use null checks
var                    // Use const/let
==                     // Use ===
console.log            // Use logger
```

## Deployment

**Stack:** Cloudflare Pages (Mini App) + Cloudflare Workers (API + bot webhook) + D1 + R2.
CI/CD: GitHub Actions. **⛔ Docker is PROHIBITED. No VPS.**

```
Telegram ─► Mini App (Pages, *.pages.dev) ─► Worker (*.workers.dev) ─► D1 / R2
Telegram Bot API ─► webhook ─► Worker
Cron Trigger ─► Worker scheduled()
```

- Custom domain: later, optional.
- Deploy only after quality gates pass on `main`.

## Session Start

**MUST read `./ROADMAP.md` first** to understand current status.
If ROADMAP.md conflicts with this file, this file wins (see Migration Status).

## Package Documentation (MANDATORY)

| File | Purpose |
|------|---------|
| `ROADMAP.md` | Milestones, tasks with checkboxes |
| `CHANGELOG.md` | Version history |
| `TODO.md` | Technical debt |

## Dependency Order

```
1. @lls/core    (domain, types, use cases)
2. @lls/worker  (uses core)
3. @lls/app     (uses core types, calls worker)
```

## SLC Rules (MANDATORY)

| Rule | Requirement |
|------|-------------|
| **v1.0 Feature** | Stage 1: order flow + status tracking ONLY |
| **Pilot** | Food business first |
| **Quality** | Must be PERFECT, not "good enough" |
| **No scope creep** | Marketplace, couriers, multi-city, online payments — NOT in v1.0 |
| **UX** | Order in 3 taps |
| **Speed** | API response < 200ms |
| **Cost** | $0/month until real usage requires more |

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

- [ ] All `console.log` removed
- [ ] `bun run lint` passes (0 errors, 0 warnings)
- [ ] `bun run build` passes
- [ ] All tests pass
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
COMMANDS: bun run format → bun run lint → bun run test → bun run build
```
