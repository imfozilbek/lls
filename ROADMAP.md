# LLS (LocalLoopSolutions) Product Roadmap

## Vision & Mission

**Vision:** Every small business in the city has access to affordable, reliable delivery.

**Mission:** Connect customers, local businesses, and couriers through a simple unified platform.

---

## Current Status: v1.0.0 Ready (100% Core Features)

### What's Done
- ✅ Domain Entities (6): Business, Product, Customer, Courier, Order, OrderItem
- ✅ Value Objects (4): Money, Address, Phone, TelegramId
- ✅ Enums (2): OrderStatus, BusinessType
- ✅ Repository Ports (5): interfaces for all entities
- ✅ Project Config: ESLint, Prettier, TypeScript, Vitest, pnpm workspace
- ✅ Application Layer: Domain Errors, DTOs, 20 Use Cases
- ✅ API Infrastructure: MongoDB schemas, Redis cache, NestJS modules
- ✅ Bot: Telegram Mini App (41 files) - stores, hooks, components, screens
- ✅ Admin: Business Panel (30 files) - auth, orders, products management
- ✅ Tests: 181 tests (157 core + 24 API controllers)
- ✅ Analytics: Dashboard, sales charts, top products

### Future Improvements
- E2E/Integration Tests (deferred to v1.1.0)
- Performance optimizations
- Additional analytics features

| Package | Version | Status | Next Milestone |
|---------|---------|--------|----------------|
| @lls/core | v0.2.0 | ✅ Complete | v0.3.0 - Notifications |
| @lls/api | v0.2.0 | ✅ Complete | v0.3.0 - WebSocket events |
| @lls/bot | v0.1.0 | ✅ Complete | v0.2.0 - Polish UI |
| @lls/admin | v0.1.0 | ✅ Complete | v0.2.0 - More analytics |

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

> **Status:** ✅ Complete
> **Files created:** 58

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

## Phase 2: @lls/api v0.1.0 — Infrastructure (NestJS)

> **Status:** ✅ Complete
> **Depends on:** Phase 1
> **Files created:** 54

### 2.1 Database Module (MongoDB)

**Path:** `packages/api/src/database/`

| File | Status | Description |
|------|--------|-------------|
| `database.module.ts` | [ ] | MongooseModule configuration |
| `schemas/business.schema.ts` | [ ] | Mongoose schema for Business |
| `schemas/product.schema.ts` | [ ] | Mongoose schema for Product |
| `schemas/customer.schema.ts` | [ ] | Mongoose schema for Customer |
| `schemas/courier.schema.ts` | [ ] | Mongoose schema for Courier |
| `schemas/order.schema.ts` | [ ] | Mongoose schema for Order |
| `schemas/index.ts` | [ ] | Export all schemas |

### 2.2 Cache Module (Redis)

**Path:** `packages/api/src/cache/`

| File | Status | Description |
|------|--------|-------------|
| `cache.module.ts` | [ ] | Redis module configuration |
| `cache.service.ts` | [ ] | CacheService with TTL |

### 2.3 Repository Implementations

**Path:** `packages/api/src/repositories/`

| File | Status | Implements |
|------|--------|------------|
| `business.repository.ts` | [ ] | BusinessRepository |
| `product.repository.ts` | [ ] | ProductRepository |
| `customer.repository.ts` | [ ] | CustomerRepository |
| `courier.repository.ts` | [ ] | CourierRepository |
| `order.repository.ts` | [ ] | OrderRepository |
| `repositories.module.ts` | [ ] | Export all repositories |

### 2.4 Common Module (Guards, Filters, Interceptors)

**Path:** `packages/api/src/common/`

| File | Status | Description |
|------|--------|-------------|
| `filters/http-exception.filter.ts` | [ ] | Global exception filter (DomainError → HTTP) |
| `filters/all-exceptions.filter.ts` | [ ] | Catch-all exception filter |
| `interceptors/logging.interceptor.ts` | [ ] | Request/Response logging |
| `guards/telegram-auth.guard.ts` | [ ] | Validate Telegram initData |
| `guards/business-auth.guard.ts` | [ ] | Validate business access |
| `decorators/telegram-user.decorator.ts` | [ ] | @TelegramUser() param decorator |
| `common.module.ts` | [ ] | Export all common providers |

### 2.5 DTOs (Validation with class-validator)

**Path:** `packages/api/src/modules/*/dto/`

| Module | Files | Status |
|--------|-------|--------|
| business | `create-business.dto.ts`, `update-business.dto.ts` | [ ] |
| product | `create-product.dto.ts`, `update-product.dto.ts` | [ ] |
| order | `create-order.dto.ts`, `update-order-status.dto.ts` | [ ] |
| courier | `take-order.dto.ts` | [ ] |
| customer | `update-customer.dto.ts` | [ ] |

### 2.6 Feature Modules

**Path:** `packages/api/src/modules/`

| Module | Files | Status |
|--------|-------|--------|
| `business/` | `business.module.ts`, `business.controller.ts`, `business.service.ts` | [ ] |
| `product/` | `product.module.ts`, `product.controller.ts`, `product.service.ts` | [ ] |
| `order/` | `order.module.ts`, `order.controller.ts`, `order.service.ts` | [ ] |
| `courier/` | `courier.module.ts`, `courier.controller.ts`, `courier.service.ts` | [ ] |
| `customer/` | `customer.module.ts`, `customer.controller.ts`, `customer.service.ts` | [ ] |

### 2.7 App Module Updates

| Task | Status |
|------|--------|
| Import DatabaseModule | [ ] |
| Import CacheModule | [ ] |
| Import CommonModule | [ ] |
| Import all feature modules | [ ] |
| Configure global filters/interceptors | [ ] |

### 2.8 Environment Variables

| Variable | Status | Description |
|----------|--------|-------------|
| MONGODB_URI | [x] | MongoDB connection string |
| REDIS_URL | [x] | Redis connection string |
| TELEGRAM_BOT_TOKEN | [x] | Telegram bot token |
| PORT | [x] | Server port (default: 4001) |
| HOST | [x] | Server host (default: 0.0.0.0) |
| LOG_LEVEL | [x] | Logging level |

---

## Phase 3: @lls/bot v0.1.0 — Telegram Mini App

> **Status:** ✅ Complete
> **Depends on:** Phase 2
> **Files created:** 41

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

> **Status:** ✅ Complete
> **Depends on:** Phase 2
> **Files created:** 30

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

> **Status:** ✅ Complete
> **Files created:** 37 test files
> **Total tests:** 181

### 5.1 Test Coverage

| Layer | Tests | Files |
|-------|-------|-------|
| Domain Entities | 55 | 6 |
| Value Objects | 35 | 4 |
| Domain Errors | 10 | 1 |
| Use Cases | 57 | 21 |
| Controllers | 24 | 5 |
| **Total** | **181** | **37** |

### 5.2 Test Files

| Package | Path | Status |
|---------|------|--------|
| @lls/core | `__tests__/domain/entities/*.test.ts` | ✅ 6 files |
| @lls/core | `__tests__/domain/value-objects/*.test.ts` | ✅ 4 files |
| @lls/core | `__tests__/domain/errors/*.test.ts` | ✅ 1 file |
| @lls/core | `__tests__/application/use-cases/*.test.ts` | ✅ 21 files |
| @lls/api | `__tests__/controllers/*.test.ts` | ✅ 5 files |

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

### @lls/api (NestJS structure)
```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── app.controller.ts          # Health/ready endpoints
├── config/
│   └── configuration.ts       # Environment validation (Zod)
├── common/
│   ├── logger.ts
│   ├── filters/
│   │   ├── http-exception.filter.ts
│   │   └── all-exceptions.filter.ts
│   ├── interceptors/
│   │   └── logging.interceptor.ts
│   ├── guards/
│   │   ├── telegram-auth.guard.ts
│   │   └── business-auth.guard.ts
│   ├── decorators/
│   │   └── telegram-user.decorator.ts
│   └── common.module.ts
├── database/
│   ├── database.module.ts
│   └── schemas/*.schema.ts
├── cache/
│   ├── cache.module.ts
│   └── cache.service.ts
├── repositories/
│   ├── *.repository.ts
│   └── repositories.module.ts
├── modules/
│   ├── business/
│   │   ├── business.module.ts
│   │   ├── business.controller.ts
│   │   ├── business.service.ts
│   │   └── dto/*.dto.ts
│   ├── product/
│   ├── order/
│   ├── courier/
│   └── customer/
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

| Phase | Package | Files | Tests | Status |
|-------|---------|-------|-------|--------|
| 1 | @lls/core | 58 | 157 | ✅ |
| 2 | @lls/api | 54 | 24 | ✅ |
| 3 | @lls/bot | 41 | - | ✅ |
| 4 | @lls/admin | 30 | - | ✅ |
| 5 | Tests | 37 | 181 | ✅ |
| **Total** | | **220** | **181** | |

**Status Legend:**
- ✅ Completed
- 🔄 In Progress
- ⏳ Planned
