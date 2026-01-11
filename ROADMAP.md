# LLS (LocalLoopSolutions) Product Roadmap

## Vision & Mission

**Vision:** Every small business in the city has access to affordable, reliable delivery.

**Mission:** Connect customers, local businesses, and couriers through a simple unified platform.

---

## Problem Statement

- Orders via phone calls get lost and confused
- No order history for customers
- Customers don't know delivery status
- Businesses lack analytics
- No unified courier database

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Clients                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  │
│  │   Telegram Mini App     │  │      Admin Panel        │  │
│  │  (Customers + Couriers) │  │     (Businesses)        │  │
│  └───────────┬─────────────┘  └───────────┬─────────────┘  │
│              └────────────────┬───────────┘                 │
└──────────────────────────────┼──────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                        @lls/api                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Modules: Auth, Business, Product, Order, Courier      │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                        @lls/core                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Domain    │  │ Application │  │    Ports    │          │
│  │  Entities   │  │  Use Cases  │  │ Interfaces  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                      Infrastructure                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  MongoDB    │  │    Redis    │  │  Telegram   │          │
│  │             │  │             │  │    API      │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

---

## Dependency Graph

```
@lls/core   ← @lls/api, @lls/bot, @lls/admin (types, DTOs, use cases)
@lls/api    ← @lls/bot, @lls/admin (HTTP)
```

---

## Business Types (MVP)

| Type | Examples |
|------|----------|
| Food | Restaurants, cafes, ready meals |
| Construction | Tools, building materials |
| Water | 20L bottles, Coca-Cola, beverages |

---

## Milestones

### Phase 1: Foundation

#### 1.1 @lls/core v0.1.0 - Domain Types
> **Status:** ⏳ Planned

| Task | Status |
|------|--------|
| Entity: Business | [ ] |
| Entity: Product | [ ] |
| Entity: Customer | [ ] |
| Entity: Courier | [ ] |
| Entity: Order | [ ] |
| Value Objects (Money, Address, Phone) | [ ] |
| Order Status enum | [ ] |
| Port interfaces | [ ] |
| Build & test | [ ] |

---

#### 1.2 @lls/api v0.1.0 - Infrastructure Setup
> **Depends on:** `@lls/core v0.1.0`

| Task | Status |
|------|--------|
| Fastify setup with TypeScript | [ ] |
| MongoDB connection (Mongoose) | [ ] |
| Redis connection | [ ] |
| Health check endpoint | [ ] |
| Error handling middleware | [ ] |
| Logger setup | [ ] |
| Build & test | [ ] |

---

### Phase 2: Core API

#### 2.1 @lls/core v0.2.0 - Use Cases
> **Depends on:** `@lls/core v0.1.0`

| Task | Status |
|------|--------|
| Use Case: ListBusinesses | [ ] |
| Use Case: GetBusinessProducts | [ ] |
| Use Case: CreateOrder | [ ] |
| Use Case: UpdateOrderStatus | [ ] |
| Use Case: AssignCourier | [ ] |
| Repository ports | [ ] |
| Build & test | [ ] |

---

#### 2.2 @lls/api v0.2.0 - Business & Product Endpoints
> **Depends on:** `@lls/core v0.2.0`, `@lls/api v0.1.0`

| Task | Status |
|------|--------|
| GET /api/businesses | [ ] |
| GET /api/businesses/:id | [ ] |
| GET /api/businesses/:id/products | [ ] |
| POST /api/products (admin) | [ ] |
| PATCH /api/products/:id (admin) | [ ] |
| DELETE /api/products/:id (admin) | [ ] |
| Swagger documentation | [ ] |
| Build & test | [ ] |

---

#### 2.3 @lls/api v0.3.0 - Order & Courier Endpoints
> **Depends on:** `@lls/api v0.2.0`

| Task | Status |
|------|--------|
| POST /api/orders | [ ] |
| GET /api/orders/:id | [ ] |
| PATCH /api/orders/:id/status | [ ] |
| GET /api/orders/business/:id | [ ] |
| GET /api/orders/courier/:id | [ ] |
| GET /api/couriers/available-orders | [ ] |
| POST /api/couriers/take-order/:id | [ ] |
| Build & test | [ ] |

---

### Phase 3: Telegram Mini App

#### 3.1 @lls/bot v0.1.0 - Customer Interface
> **Depends on:** `@lls/api v0.3.0`

| Task | Status |
|------|--------|
| Telegram Mini App setup | [ ] |
| Telegram initData validation | [ ] |
| Business catalog screen | [ ] |
| Product list screen | [ ] |
| Cart functionality | [ ] |
| Order placement | [ ] |
| Order status tracking | [ ] |
| Order history | [ ] |
| Build & test | [ ] |

---

#### 3.2 @lls/bot v0.2.0 - Courier Interface
> **Depends on:** `@lls/bot v0.1.0`

| Task | Status |
|------|--------|
| Courier mode toggle | [ ] |
| Available orders list | [ ] |
| Take order action | [ ] |
| Status updates (picked_up, delivered) | [ ] |
| Earnings view | [ ] |
| Build & test | [ ] |

---

### Phase 4: Admin Panel

#### 4.1 @lls/admin v0.1.0 - Business Dashboard
> **Depends on:** `@lls/api v0.3.0`

| Task | Status |
|------|--------|
| Fastify static server setup | [ ] |
| Business authentication | [ ] |
| Orders list (incoming) | [ ] |
| Accept/reject order | [ ] |
| Order status management | [ ] |
| Build & test | [ ] |

---

#### 4.2 @lls/admin v0.2.0 - Product Management
> **Depends on:** `@lls/admin v0.1.0`

| Task | Status |
|------|--------|
| Product CRUD interface | [ ] |
| Category management | [ ] |
| Availability toggle | [ ] |
| Image upload | [ ] |
| Build & test | [ ] |

---

### Phase 5: Enhancements

#### 5.1 Notifications
> **Depends on:** Phase 4

| Task | Status |
|------|--------|
| Telegram notifications to business | [ ] |
| Telegram notifications to customer | [ ] |
| Telegram notifications to courier | [ ] |
| Build & test | [ ] |

---

#### 5.2 Analytics
> **Depends on:** Phase 4

| Task | Status |
|------|--------|
| Business statistics dashboard | [ ] |
| Order analytics | [ ] |
| Revenue reports | [ ] |
| Build & test | [ ] |

---

## Current Status

| Package | Version | Status | Next Milestone |
|---------|---------|--------|----------------|
| @lls/core | v0.0.0 | ⏳ Planned | v0.1.0 - Domain Types |
| @lls/api | v0.0.0 | ⏳ Planned | v0.1.0 - Infrastructure |
| @lls/bot | v0.0.0 | ⏳ Planned | v0.1.0 - Customer UI |
| @lls/admin | v0.0.0 | ⏳ Planned | v0.1.0 - Dashboard |

**Status Legend:**
- ✅ Completed
- 🔄 In Progress
- ⏳ Planned

---

## API Endpoints Summary

### Public (Customer)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/businesses | List all businesses |
| GET | /api/businesses/:id | Get business details |
| GET | /api/businesses/:id/products | Get business products |
| POST | /api/orders | Create order |
| GET | /api/orders/:id | Get order status |

### Courier
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/couriers/available-orders | List available orders |
| POST | /api/couriers/take-order/:id | Take an order |
| PATCH | /api/orders/:id/status | Update delivery status |

### Business (Admin)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/orders/business/:id | List business orders |
| PATCH | /api/orders/:id/status | Accept/reject order |
| POST | /api/products | Create product |
| PATCH | /api/products/:id | Update product |
| DELETE | /api/products/:id | Delete product |

---

## Payment Model

**MVP:** Cash on delivery (businesses handle payment directly)
**Platform:** Tracks order amounts for analytics

**Future:**
- Commission per order (5-15%)
- Business subscription
- Catalog promotion

---

## Release Checklist

```markdown
## Release: @lls/package vX.X.X

### Quality Gates
- [ ] `pnpm format` - no changes
- [ ] `pnpm build` - compiles
- [ ] `pnpm lint` - 0 errors, 0 warnings
- [ ] `pnpm test` - all pass

### Documentation
- [ ] CHANGELOG.md updated
- [ ] ROADMAP.md milestone marked ✅

### Release
- [ ] Version bumped in package.json
- [ ] Git tag: `<package>-v<version>`
- [ ] Pushed to origin
```
