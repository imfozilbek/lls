# CLAUDE.md

> **ALL RULES ARE MANDATORY. Zero tolerance for violations.**

## Task Workflow (MANDATORY)

**⛔ MUST enter planning mode before starting ANY new task.**

| Rule | Requirement |
|------|-------------|
| **New tasks** | Always use `EnterPlanMode` tool first |
| **Purpose** | Plan implementation steps before writing code |
| **Exit** | Use `ExitPlanMode` only after plan is approved |

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

## Project Overview

LLS (LocalLoopSolutions) — Local delivery platform for small businesses. TypeScript monorepo (pnpm workspaces). Node.js >= 22.0.0.

| Package | Description |
|---------|-------------|
| `@lls/core` | Domain logic (DDD): entities, use cases, ports |
| `@lls/api` | NestJS REST API (Fastify adapter) |
| `@lls/bot` | Telegram Mini App (clients + couriers) |
| `@lls/admin` | Web admin panel (businesses) |

**Root:** `/Users/fozilbeksamiyev/projects/lls`

## Commands

```bash
pnpm build                    # Build all
pnpm test                     # Test all
pnpm format                   # Format (4 spaces)
pnpm lint                     # Lint (0 errors, 0 warnings)
pnpm dev                      # Dev mode
pnpm --filter @lls/api build  # Build specific package
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
Infrastructure     → Controllers, Repositories, Adapters
```

**RULES:**
- Domain NEVER imports from outer layers
- Entities have behavior, not just data
- Value Objects are immutable
- API returns DTOs, not entities
- No magic numbers/strings
- No hardcoded secrets

## NestJS Architecture (@lls/api)

```
src/
├── main.ts                    # Bootstrap with Fastify adapter
├── app.module.ts              # Root module
├── app.controller.ts          # Health endpoints
├── config/configuration.ts    # Env validation (Zod)
├── common/                    # Shared: guards, filters, interceptors
├── database/                  # MongooseModule + schemas
├── cache/                     # Redis module
├── repositories/              # Repository implementations
└── modules/                   # Feature modules (business, order, etc.)
```

**NestJS Rules:**
- One module per feature (business, product, order, courier, customer)
- Services inject repositories via constructor
- Controllers use DTOs with class-validator
- Guards for auth (Telegram, Business)
- Filters for exception handling (DomainError → HTTP)
- Use `@nestjs/mongoose` for MongoDB
- Use Fastify adapter (not Express)

## Domain Models

| Entity | Key Fields |
|--------|------------|
| Business | id, name, type (food/construction/water), address, telegram_id |
| Product | id, business_id, name, price, category, is_available |
| Customer | id, telegram_id, name, phone, address |
| Courier | id, telegram_id, name, phone, is_available |
| Order | id, customer_id, business_id, courier_id, items, status, total |

**Order Status Flow:**
```
pending → accepted → preparing → ready → picked_up → delivered
    ↓         ↓          ↓         ↓         ↓
cancelled  cancelled  cancelled  cancelled  cancelled
```

## Git Commits

```
<type>(<package>): <subject>
feat(api): add order endpoints
fix(bot): resolve cart issue
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

## Release Command

When user types `release` or `release @lls/<package>`:

### 1. Quality Gates (run sequentially, stop on failure)
```bash
pnpm format   # Must have no changes
pnpm build    # Must compile
pnpm lint     # 0 errors, 0 warnings
pnpm test     # All tests pass
```

### 2. Documentation
- Create/update `CHANGELOG.md` with changes since last release
- Mark completed tasks in `ROADMAP.md` as ✅

### 3. Version & Tag
- Bump version in `package.json` (ask user: patch/minor/major)
- Create git commit: `chore(<package>): release v<version>`
- Create git tag: `<package>-v<version>`

### 4. Push
- Push commits and tags to origin

**If any step fails:** Stop immediately, report error, do not continue.

## Security (MANDATORY)

**FORBIDDEN:**
```typescript
eval(userInput)           // Code injection
new Function(userInput)   // Code injection
document.innerHTML = x    // XSS
`query ${userInput}`      // Injection
```

**REQUIRED:**
- Secrets in `.env` only
- Validate all inputs (especially Telegram data)
- Never log passwords/tokens/secrets
- Verify Telegram WebApp initData
- Check `git diff` before commit

## Testing (MANDATORY)

| Layer | Min Coverage |
|-------|--------------|
| Domain | 90% |
| Use Cases | 80% |
| Controllers | 70% |

## Database (MongoDB + Redis, self-hosted)

**⛔ No other databases allowed.**

**MongoDB:**
```typescript
// Always: index frequently queried fields
// Always: use transactions for multi-doc ops
// Index: business_id, customer_id, courier_id, status
```

**Redis:**
```typescript
// Key pattern: lls:{entity}:{id}:{field}
// Always set TTL: redis.setex(key, 3600, value)
```

## Performance (MANDATORY)

| Metric | Limit |
|--------|-------|
| API response | < 200ms (p95) |
| DB query | < 100ms |
| Memory | < 512MB |

**AVOID:**
- N+1 queries — use aggregation
- Missing indexes
- Fetching all fields — use projection
- No pagination
- Cache without TTL

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
// ALWAYS validate initData from Telegram
// Use @telegram-apps/init-data-node
// Never trust client-side data without validation
```

**User Flow:**
- Customer: Browse → Cart → Order → Track
- Courier: Available orders → Take → Deliver

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

**Stack:** Hostinger VPS, PM2 + Nginx, CI/CD Gitea (self-hosted). **⛔ Docker is PROHIBITED.**

```
Nginx → /api/* → PM2: api (port 4001)
      → /admin/* → static files
      → Bot webhook → PM2: bot
```

## Session Start

**MUST read `./ROADMAP.md` first** to understand current status.

## Package Documentation (MANDATORY)

| File | Purpose |
|------|---------|
| `ROADMAP.md` | Milestones, tasks with checkboxes |
| `CHANGELOG.md` | Version history |
| `TODO.md` | Technical debt |

## Dependency Order

```
1. @lls/core    (domain, types, use cases)
2. @lls/api     (uses core)
3. @lls/bot     (uses core, calls api)
4. @lls/admin   (uses core, calls api)
```

---

## Quick Reference

```
MUST: Return types | await promises | const | curly braces | ===
NEVER: any | console.log | floating promises | var | secrets in code | Docker
LIMITS: 5 params | 100 lines | 4 depth | 15 complexity
COMMANDS: pnpm format → pnpm lint → pnpm test → pnpm build
```
