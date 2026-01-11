# LLS (LocalLoopSolutions) Product Roadmap

## Vision & Mission

**Vision:** Every small business in the city has access to affordable, reliable delivery.

**Mission:** Connect customers, local businesses, and couriers through a simple unified platform.

---

## Current Status: 10% Complete

### What's Done
- Domain Entities (6): Business, Product, Customer, Courier, Order, OrderItem
- Value Objects (4): Money, Address, Phone, TelegramId
- Enums (2): OrderStatus, BusinessType
- Repository Ports (5): interfaces for all entities
- Project Config: ESLint, Prettier, TypeScript, Vitest, pnpm workspace
- API Skeleton: Fastify app, /health, /ready, env validation, logger

### What's Missing (90%)
- Application Layer (Use Cases, DTOs, Errors)
- Infrastructure (MongoDB, Redis, Repositories)
- API (Controllers, Routes, Middleware, Schemas)
- Bot (Telegram SDK, Screens, Components, State)
- Admin (Auth, Components, Screens)
- Tests (0% coverage)

| Package | Version | Status | Next Milestone |
|---------|---------|--------|----------------|
| @lls/core | v0.0.0 | 🔄 In Progress | v0.1.0 - Application Layer |
| @lls/api | v0.0.0 | ⏳ Planned | v0.1.0 - Infrastructure |
| @lls/bot | v0.0.0 | ⏳ Planned | v0.1.0 - Customer UI |
| @lls/admin | v0.0.0 | ⏳ Planned | v0.1.0 - Dashboard |

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

## Phase 1: @lls/core v0.1.0 — Application Layer

> **Status:** ⏳ Planned
> **Files to create:** ~25

### 1.1 Domain Errors

**Path:** `packages/core/src/domain/errors/`

| File | Status | Description |
|------|--------|-------------|
| `domain-error.ts` | [ ] | Base class for all domain errors |
| `entity-not-found.error.ts` | [ ] | EntityNotFoundError |
| `invalid-transition.error.ts` | [ ] | InvalidOrderTransitionError |
| `validation.error.ts` | [ ] | ValidationError |
| `business-rule.error.ts` | [ ] | BusinessRuleViolationError |
| `index.ts` | [ ] | Export all errors |

### 1.2 DTOs (Data Transfer Objects)

**Path:** `packages/core/src/application/dtos/`

| File | Status | Description |
|------|--------|-------------|
| `business.dto.ts` | [ ] | BusinessDTO, BusinessListDTO |
| `product.dto.ts` | [ ] | ProductDTO, ProductListDTO |
| `customer.dto.ts` | [ ] | CustomerDTO |
| `courier.dto.ts` | [ ] | CourierDTO |
| `order.dto.ts` | [ ] | OrderDTO, OrderItemDTO, OrderListDTO |
| `index.ts` | [ ] | Export all DTOs |

### 1.3 Use Cases

**Path:** `packages/core/src/application/use-cases/`

#### Business Use Cases
| File | Status | Method | Input → Output |
|------|--------|--------|----------------|
| `list-businesses.use-case.ts` | [ ] | execute(filter?) | BusinessFilter → BusinessDTO[] |
| `get-business.use-case.ts` | [ ] | execute(id) | string → BusinessDTO |
| `get-business-products.use-case.ts` | [ ] | execute(businessId) | string → ProductDTO[] |
| `create-business.use-case.ts` | [ ] | execute(data) | CreateBusinessInput → BusinessDTO |
| `update-business.use-case.ts` | [ ] | execute(id, data) | UpdateBusinessInput → BusinessDTO |

#### Product Use Cases
| File | Status | Method | Input → Output |
|------|--------|--------|----------------|
| `create-product.use-case.ts` | [ ] | execute(data) | CreateProductInput → ProductDTO |
| `update-product.use-case.ts` | [ ] | execute(id, data) | UpdateProductInput → ProductDTO |
| `delete-product.use-case.ts` | [ ] | execute(id) | string → void |
| `toggle-product-availability.use-case.ts` | [ ] | execute(id) | string → ProductDTO |

#### Order Use Cases
| File | Status | Method | Input → Output |
|------|--------|--------|----------------|
| `create-order.use-case.ts` | [ ] | execute(data) | CreateOrderInput → OrderDTO |
| `get-order.use-case.ts` | [ ] | execute(id) | string → OrderDTO |
| `get-customer-orders.use-case.ts` | [ ] | execute(customerId) | string → OrderDTO[] |
| `get-business-orders.use-case.ts` | [ ] | execute(businessId, status?) | GetBusinessOrdersInput → OrderDTO[] |
| `update-order-status.use-case.ts` | [ ] | execute(id, status) | UpdateOrderStatusInput → OrderDTO |
| `cancel-order.use-case.ts` | [ ] | execute(id, reason?) | CancelOrderInput → OrderDTO |

#### Courier Use Cases
| File | Status | Method | Input → Output |
|------|--------|--------|----------------|
| `get-available-orders.use-case.ts` | [ ] | execute(courierId) | string → OrderDTO[] |
| `take-order.use-case.ts` | [ ] | execute(orderId, courierId) | TakeOrderInput → OrderDTO |
| `complete-delivery.use-case.ts` | [ ] | execute(orderId) | string → OrderDTO |
| `get-courier-orders.use-case.ts` | [ ] | execute(courierId) | string → OrderDTO[] |

#### Customer Use Cases
| File | Status | Method | Input → Output |
|------|--------|--------|----------------|
| `get-or-create-customer.use-case.ts` | [ ] | execute(telegramData) | TelegramUserData → CustomerDTO |
| `update-customer.use-case.ts` | [ ] | execute(id, data) | UpdateCustomerInput → CustomerDTO |

### 1.4 Tests

**Path:** `packages/core/src/__tests__/`

| Directory | Status | Coverage Target |
|-----------|--------|-----------------|
| `domain/entities/*.test.ts` | [ ] | 90% |
| `domain/value-objects/*.test.ts` | [ ] | 90% |
| `domain/errors/*.test.ts` | [ ] | 90% |
| `application/use-cases/*.test.ts` | [ ] | 80% |

### 1.5 Update index.ts exports

| Task | Status |
|------|--------|
| Export domain errors | [ ] |
| Export DTOs | [ ] |
| Export Use Cases | [ ] |

---

## Phase 2: @lls/api v0.1.0 — Infrastructure

> **Status:** ⏳ Planned
> **Depends on:** Phase 1
> **Files to create:** ~20

### 2.1 MongoDB Connection

**Path:** `packages/api/src/infrastructure/database/`

| File | Status | Description |
|------|--------|-------------|
| `connection.ts` | [ ] | MongoDB connection with retry logic |
| `models/business.model.ts` | [ ] | Mongoose schema for Business |
| `models/product.model.ts` | [ ] | Mongoose schema for Product |
| `models/customer.model.ts` | [ ] | Mongoose schema for Customer |
| `models/courier.model.ts` | [ ] | Mongoose schema for Courier |
| `models/order.model.ts` | [ ] | Mongoose schema for Order |
| `models/index.ts` | [ ] | Export all models |

### 2.2 Redis Connection

**Path:** `packages/api/src/infrastructure/cache/`

| File | Status | Description |
|------|--------|-------------|
| `redis-client.ts` | [ ] | Redis connection |
| `cache.service.ts` | [ ] | CacheService with TTL |

### 2.3 Repository Implementations

**Path:** `packages/api/src/infrastructure/repositories/`

| File | Status | Implements |
|------|--------|------------|
| `mongo-business.repository.ts` | [ ] | BusinessRepository |
| `mongo-product.repository.ts` | [ ] | ProductRepository |
| `mongo-customer.repository.ts` | [ ] | CustomerRepository |
| `mongo-courier.repository.ts` | [ ] | CourierRepository |
| `mongo-order.repository.ts` | [ ] | OrderRepository |

### 2.4 Middleware

**Path:** `packages/api/src/middleware/`

| File | Status | Description |
|------|--------|-------------|
| `error-handler.ts` | [ ] | Global error handling (DomainError → HTTP) |
| `request-logger.ts` | [ ] | Request/Response logging |
| `telegram-auth.ts` | [ ] | Validate Telegram initData |
| `business-auth.ts` | [ ] | Validate business access |

### 2.5 Zod Schemas

**Path:** `packages/api/src/schemas/`

| File | Status | Description |
|------|--------|-------------|
| `business.schema.ts` | [ ] | Business request/response schemas |
| `product.schema.ts` | [ ] | Product request/response schemas |
| `order.schema.ts` | [ ] | Order request/response schemas |
| `courier.schema.ts` | [ ] | Courier request/response schemas |
| `common.schema.ts` | [ ] | Shared schemas (pagination, address) |

### 2.6 Controllers

**Path:** `packages/api/src/controllers/`

| File | Status | Routes |
|------|--------|--------|
| `business.controller.ts` | [ ] | GET /businesses, GET /businesses/:id |
| `product.controller.ts` | [ ] | GET /businesses/:id/products, POST/PATCH/DELETE /products |
| `order.controller.ts` | [ ] | POST /orders, GET /orders/:id, PATCH /orders/:id/status |
| `courier.controller.ts` | [ ] | GET /couriers/available-orders, POST /couriers/take-order/:id |
| `customer.controller.ts` | [ ] | GET /customers/me, PATCH /customers/me |

### 2.7 Routes & DI Container

**Path:** `packages/api/src/`

| File | Status | Description |
|------|--------|-------------|
| `routes/index.ts` | [ ] | Register all routes |
| `container.ts` | [ ] | Dependency Injection container |

### 2.8 Environment Variables

| Task | Status |
|------|--------|
| Add MONGODB_URI | [ ] |
| Add REDIS_URI | [ ] |
| Add TELEGRAM_BOT_TOKEN | [ ] |
| Update env.ts validation | [ ] |

---

## Phase 3: @lls/bot v0.1.0 — Telegram Mini App

> **Status:** ⏳ Planned
> **Depends on:** Phase 2
> **Files to create:** ~30

### 3.1 Core Setup

**Path:** `packages/bot/src/lib/`

| File | Status | Description |
|------|--------|-------------|
| `telegram.ts` | [ ] | Telegram SDK initialization |
| `api-client.ts` | [ ] | HTTP client for @lls/api |
| `utils.ts` | [ ] | Helper functions (cn, formatMoney) |

### 3.2 State Management (Zustand)

**Path:** `packages/bot/src/stores/`

| File | Status | Description |
|------|--------|-------------|
| `auth.store.ts` | [ ] | Telegram user state |
| `cart.store.ts` | [ ] | Shopping cart |
| `order.store.ts` | [ ] | Orders |
| `courier.store.ts` | [ ] | Courier mode |

### 3.3 Hooks

**Path:** `packages/bot/src/hooks/`

| File | Status | Description |
|------|--------|-------------|
| `useApi.ts` | [ ] | API hooks |
| `useTelegram.ts` | [ ] | Telegram hooks |
| `useCart.ts` | [ ] | Cart logic |

### 3.4 UI Components

**Path:** `packages/bot/src/components/ui/`

| File | Status | Description |
|------|--------|-------------|
| `Button.tsx` | [ ] | Button component |
| `Input.tsx` | [ ] | Input component |
| `Card.tsx` | [ ] | Card component |
| `Modal.tsx` | [ ] | Modal component |
| `Loading.tsx` | [ ] | Loading spinner |
| `Badge.tsx` | [ ] | Badge component |

### 3.5 Layout Components

**Path:** `packages/bot/src/components/layout/`

| File | Status | Description |
|------|--------|-------------|
| `Header.tsx` | [ ] | Header with back button |
| `BottomNav.tsx` | [ ] | Bottom navigation |
| `Layout.tsx` | [ ] | Main layout wrapper |

### 3.6 Feature Components

**Path:** `packages/bot/src/components/`

| Directory | Files | Status |
|-----------|-------|--------|
| `business/` | BusinessCard.tsx, BusinessList.tsx | [ ] |
| `product/` | ProductCard.tsx, ProductList.tsx | [ ] |
| `cart/` | CartItem.tsx, CartSummary.tsx, CartButton.tsx | [ ] |
| `order/` | OrderCard.tsx, OrderStatus.tsx, OrderHistory.tsx | [ ] |

### 3.7 Customer Screens

**Path:** `packages/bot/src/screens/customer/`

| File | Status | Description |
|------|--------|-------------|
| `Home.tsx` | [ ] | Business list |
| `Business.tsx` | [ ] | Products of business |
| `Cart.tsx` | [ ] | Cart view |
| `Checkout.tsx` | [ ] | Place order |
| `OrderTracking.tsx` | [ ] | Track order |
| `Orders.tsx` | [ ] | Order history |

### 3.8 Courier Screens

**Path:** `packages/bot/src/screens/courier/`

| File | Status | Description |
|------|--------|-------------|
| `AvailableOrders.tsx` | [ ] | Available orders list |
| `ActiveDelivery.tsx` | [ ] | Active delivery |
| `Earnings.tsx` | [ ] | Earnings view |

### 3.9 App Router

| Task | Status |
|------|--------|
| Update App.tsx with routes | [ ] |
| Configure react-router-dom | [ ] |

---

## Phase 4: @lls/admin v0.1.0 — Business Panel

> **Status:** ⏳ Planned
> **Depends on:** Phase 2
> **Files to create:** ~20

### 4.1 Core Setup

**Path:** `packages/admin/src/lib/`

| File | Status | Description |
|------|--------|-------------|
| `api-client.ts` | [ ] | HTTP client for @lls/api |
| `utils.ts` | [ ] | Helper functions |

### 4.2 State Management

**Path:** `packages/admin/src/stores/`

| File | Status | Description |
|------|--------|-------------|
| `auth.store.ts` | [ ] | Business auth state |
| `orders.store.ts` | [ ] | Orders state |

### 4.3 UI Components

**Path:** `packages/admin/src/components/ui/`

| File | Status | Description |
|------|--------|-------------|
| `Button.tsx` | [ ] | Button component |
| `Input.tsx` | [ ] | Input component |
| `Table.tsx` | [ ] | Table component |
| `Modal.tsx` | [ ] | Modal component |
| `Badge.tsx` | [ ] | Badge component |

### 4.4 Layout Components

**Path:** `packages/admin/src/components/layout/`

| File | Status | Description |
|------|--------|-------------|
| `Sidebar.tsx` | [ ] | Sidebar navigation |
| `Header.tsx` | [ ] | Header component |
| `Layout.tsx` | [ ] | Main layout wrapper |

### 4.5 Feature Components

| Directory | Files | Status |
|-----------|-------|--------|
| `orders/` | OrdersTable.tsx, OrderDetails.tsx, OrderStatusBadge.tsx | [ ] |
| `products/` | ProductsTable.tsx, ProductForm.tsx, ProductCard.tsx | [ ] |

### 4.6 Pages

**Path:** `packages/admin/src/pages/`

| File | Status | Description |
|------|--------|-------------|
| `Login.tsx` | [ ] | Login page |
| `Dashboard.tsx` | [ ] | Stats overview |
| `Orders.tsx` | [ ] | Orders management |
| `Products.tsx` | [ ] | Products CRUD |
| `Settings.tsx` | [ ] | Settings page |

---

## Phase 5: Testing & Quality

> **Status:** ⏳ Planned
> **Files to create:** ~15

### 5.1 Test Coverage Requirements

| Layer | Target | Current |
|-------|--------|---------|
| Domain Entities | 90% | 0% |
| Value Objects | 90% | 0% |
| Use Cases | 80% | 0% |
| Controllers | 70% | 0% |

### 5.2 Test Files

| Package | Path | Status |
|---------|------|--------|
| @lls/core | `__tests__/domain/entities/*.test.ts` | [ ] |
| @lls/core | `__tests__/domain/value-objects/*.test.ts` | [ ] |
| @lls/core | `__tests__/application/use-cases/*.test.ts` | [ ] |
| @lls/api | `__tests__/controllers/*.test.ts` | [ ] |
| @lls/api | `__tests__/integration/*.test.ts` | [ ] |

---

## API Endpoints Summary

### Public (Customer)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /api/v1/businesses | List businesses | Telegram |
| GET | /api/v1/businesses/:id | Get business | Telegram |
| GET | /api/v1/businesses/:id/products | Get products | Telegram |
| POST | /api/v1/orders | Create order | Telegram |
| GET | /api/v1/orders/:id | Get order | Telegram |
| GET | /api/v1/orders/my | My orders | Telegram |
| GET | /api/v1/customers/me | Get profile | Telegram |
| PATCH | /api/v1/customers/me | Update profile | Telegram |

### Courier
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /api/v1/couriers/available-orders | Available orders | Telegram |
| POST | /api/v1/couriers/take-order/:id | Take order | Telegram |
| PATCH | /api/v1/orders/:id/status | Update status | Telegram |
| GET | /api/v1/couriers/my-orders | My deliveries | Telegram |

### Business (Admin)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /api/v1/orders/business/:id | Business orders | Business |
| PATCH | /api/v1/orders/:id/status | Accept/reject | Business |
| POST | /api/v1/products | Create product | Business |
| PATCH | /api/v1/products/:id | Update product | Business |
| DELETE | /api/v1/products/:id | Delete product | Business |

---

## File Structure (After Implementation)

### @lls/core (new files)
```
src/
├── domain/errors/
│   ├── domain-error.ts
│   ├── entity-not-found.error.ts
│   ├── invalid-transition.error.ts
│   ├── validation.error.ts
│   ├── business-rule.error.ts
│   └── index.ts
├── application/dtos/
│   ├── business.dto.ts
│   ├── product.dto.ts
│   ├── customer.dto.ts
│   ├── courier.dto.ts
│   ├── order.dto.ts
│   └── index.ts
├── application/use-cases/
│   ├── business/
│   ├── product/
│   ├── order/
│   ├── courier/
│   └── index.ts
└── __tests__/
    ├── domain/entities/*.test.ts
    ├── domain/value-objects/*.test.ts
    └── application/use-cases/*.test.ts
```

### @lls/api (new files)
```
src/
├── infrastructure/
│   ├── database/
│   │   ├── connection.ts
│   │   └── models/*.model.ts
│   ├── cache/
│   │   ├── redis-client.ts
│   │   └── cache.service.ts
│   └── repositories/*.repository.ts
├── middleware/*.ts
├── schemas/*.schema.ts
├── controllers/*.controller.ts
├── routes/index.ts
├── container.ts
└── __tests__/
```

### @lls/bot (new files)
```
src/
├── lib/
├── stores/
├── hooks/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── business/
│   ├── product/
│   ├── cart/
│   └── order/
└── screens/
    ├── customer/
    └── courier/
```

---

## Verification Checklist

### After each phase:
```bash
pnpm format          # Format check
pnpm build           # Build all
pnpm lint            # 0 errors, 0 warnings
pnpm test            # All tests pass
pnpm test --coverage # Coverage check
```

### E2E Verification:
1. **Core**: Run unit tests for entities and use cases
2. **API**: Start server, test endpoints via curl/Postman
3. **Bot**: Start dev server, test user flow in browser
4. **Integration**: Create test order, verify in MongoDB

---

## Business Types (MVP)

| Type | Examples |
|------|----------|
| Food | Restaurants, cafes, ready meals |
| Construction | Tools, building materials |
| Water | 20L bottles, Coca-Cola, beverages |

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

---

## Summary

| Phase | Package | Files | Status |
|-------|---------|-------|--------|
| 1 | @lls/core | ~25 | ⏳ |
| 2 | @lls/api | ~20 | ⏳ |
| 3 | @lls/bot | ~30 | ⏳ |
| 4 | @lls/admin | ~20 | ⏳ |
| 5 | Tests | ~15 | ⏳ |
| **Total** | | **~110** | |

**Status Legend:**
- ✅ Completed
- 🔄 In Progress
- ⏳ Planned
