# @lls/api Roadmap

> NestJS REST API: endpoints, middleware, adapters

## Overview

| Version | Focus | Depends On | Status |
|---------|-------|------------|--------|
| v0.1.0 | Infrastructure | @lls/core v0.1.0 | ✅ Complete |
| v0.2.0 | Feature Modules | @lls/core v0.2.0 | ✅ Complete |
| v0.3.0 | WebSocket Events | v0.2.0 | ✅ Complete |
| v0.4.0 | Advanced Security | v0.3.0 | ⏳ Planned |

---

## v0.1.0 - Infrastructure Setup

> Foundation: NestJS, MongoDB, Redis, logging

### Server Setup

| Task | File | Status |
|------|------|--------|
| NestJS main bootstrap | `src/main.ts` | [x] |
| App module | `src/app.module.ts` | [x] |
| App controller (health) | `src/app.controller.ts` | [x] |
| Environment config (Zod) | `src/config/configuration.ts` | [x] |
| Fastify adapter | `src/main.ts` | [x] |

### Database Module

| Task | File | Status |
|------|------|--------|
| Database module | `src/database/database.module.ts` | [x] |
| Business schema | `src/database/schemas/business.schema.ts` | [x] |
| Product schema | `src/database/schemas/product.schema.ts` | [x] |
| Customer schema | `src/database/schemas/customer.schema.ts` | [x] |
| Courier schema | `src/database/schemas/courier.schema.ts` | [x] |
| Order schema | `src/database/schemas/order.schema.ts` | [x] |
| Analytics schema | `src/database/schemas/analytics.schema.ts` | [x] |
| Index exports | `src/database/schemas/index.ts` | [x] |

### Cache Module

| Task | File | Status |
|------|------|--------|
| Cache module | `src/cache/cache.module.ts` | [x] |
| Cache service | `src/cache/cache.service.ts` | [x] |
| Cache constants | `src/cache/cache.constants.ts` | [x] |

### Common Module

| Task | File | Status |
|------|------|--------|
| HTTP exception filter | `src/common/filters/http-exception.filter.ts` | [x] |
| All exceptions filter | `src/common/filters/all-exceptions.filter.ts` | [x] |
| Logging interceptor | `src/common/interceptors/logging.interceptor.ts` | [x] |
| Transform interceptor | `src/common/interceptors/transform.interceptor.ts` | [x] |
| Telegram auth guard | `src/common/guards/telegram-auth.guard.ts` | [x] |
| Business auth guard | `src/common/guards/business-auth.guard.ts` | [x] |
| TelegramUser decorator | `src/common/decorators/telegram-user.decorator.ts` | [x] |
| BusinessAuthMode decorator | `src/common/decorators/business-auth-mode.decorator.ts` | [x] |
| Logger utility | `src/common/logger.ts` | [x] |
| Common module | `src/common/common.module.ts` | [x] |

### Package Setup

| Task | File | Status |
|------|------|--------|
| package.json | `package.json` | [x] |
| tsconfig.json | `tsconfig.json` | [x] |
| ESLint config | `eslint.config.mjs` | [x] |
| Vitest config | `vitest.config.ts` | [x] |
| .env.example | `.env.example` | [x] |

---

## v0.2.0 - Feature Modules

> All business logic endpoints

### Repository Implementations

| Task | File | Status |
|------|------|--------|
| Business repository | `src/infrastructure/repositories/mongodb-business.repository.ts` | [x] |
| Product repository | `src/infrastructure/repositories/mongodb-product.repository.ts` | [x] |
| Customer repository | `src/infrastructure/repositories/mongodb-customer.repository.ts` | [x] |
| Courier repository | `src/infrastructure/repositories/mongodb-courier.repository.ts` | [x] |
| Order repository | `src/infrastructure/repositories/mongodb-order.repository.ts` | [x] |
| Analytics repository | `src/infrastructure/repositories/mongodb-analytics.repository.ts` | [x] |

### Business Module

| Task | File | Status |
|------|------|--------|
| Business module | `src/modules/business/business.module.ts` | [x] |
| Business controller | `src/modules/business/business.controller.ts` | [x] |
| Business service | `src/modules/business/business.service.ts` | [x] |
| Telegram login DTO | `src/modules/business/dto/telegram-login.dto.ts` | [x] |
| Create business DTO | `src/modules/business/dto/create-business.dto.ts` | [x] |
| Update business DTO | `src/modules/business/dto/update-business.dto.ts` | [x] |

### Product Module

| Task | File | Status |
|------|------|--------|
| Product module | `src/modules/product/product.module.ts` | [x] |
| Product controller | `src/modules/product/product.controller.ts` | [x] |
| Product service | `src/modules/product/product.service.ts` | [x] |
| Create product DTO | `src/modules/product/dto/create-product.dto.ts` | [x] |
| Update product DTO | `src/modules/product/dto/update-product.dto.ts` | [x] |

### Order Module

| Task | File | Status |
|------|------|--------|
| Order module | `src/modules/order/order.module.ts` | [x] |
| Order controller | `src/modules/order/order.controller.ts` | [x] |
| Order service | `src/modules/order/order.service.ts` | [x] |
| Create order DTO | `src/modules/order/dto/create-order.dto.ts` | [x] |
| Update order status DTO | `src/modules/order/dto/update-order-status.dto.ts` | [x] |

### Courier Module

| Task | File | Status |
|------|------|--------|
| Courier module | `src/modules/courier/courier.module.ts` | [x] |
| Courier controller | `src/modules/courier/courier.controller.ts` | [x] |
| Courier service | `src/modules/courier/courier.service.ts` | [x] |

### Customer Module

| Task | File | Status |
|------|------|--------|
| Customer module | `src/modules/customer/customer.module.ts` | [x] |
| Customer controller | `src/modules/customer/customer.controller.ts` | [x] |
| Customer service | `src/modules/customer/customer.service.ts` | [x] |
| Update customer DTO | `src/modules/customer/dto/update-customer.dto.ts` | [x] |

### Analytics Module

| Task | File | Status |
|------|------|--------|
| Analytics module | `src/modules/analytics/analytics.module.ts` | [x] |
| Analytics controller | `src/modules/analytics/analytics.controller.ts` | [x] |
| Analytics service | `src/modules/analytics/analytics.service.ts` | [x] |

### API Endpoints

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | /businesses | List all businesses | [x] |
| GET | /businesses/:id | Get business by ID | [x] |
| POST | /businesses | Create business | [x] |
| PATCH | /businesses/:id | Update business | [x] |
| GET | /businesses/telegram/:telegramId | Get by Telegram ID | [x] |
| POST | /businesses/auth/telegram | Telegram OAuth login | [x] |
| GET | /businesses/:businessId/orders | Get business orders | [x] |
| POST | /businesses/:businessId/products | Create product | [x] |
| GET | /businesses/:businessId/products | Get business products | [x] |
| PATCH | /products/:id | Update product | [x] |
| DELETE | /products/:id | Delete product | [x] |
| PATCH | /products/:id/availability | Toggle availability | [x] |
| POST | /orders | Create order | [x] |
| GET | /orders/:id | Get order | [x] |
| GET | /orders/my | Get customer orders | [x] |
| PATCH | /orders/:id/status | Update order status | [x] |
| POST | /orders/:id/cancel | Cancel order | [x] |
| GET | /couriers/available-orders | Get available orders | [x] |
| POST | /orders/:orderId/take | Take order | [x] |
| POST | /orders/:orderId/complete | Complete delivery | [x] |
| GET | /couriers/my-orders | Get courier orders | [x] |
| GET | /customers/me | Get customer profile | [x] |
| PATCH | /customers/me | Update customer profile | [x] |
| POST | /customers/telegram | Get or create customer | [x] |
| GET | /analytics/business/:businessId | Full dashboard | [x] |
| GET | /analytics/business/:businessId/sales | Sales chart | [x] |
| GET | /analytics/business/:businessId/top-products | Top products | [x] |

---

## v0.3.0 - WebSocket Events

> Real-time updates for orders and notifications

### WebSocket Setup

| Task | File | Status |
|------|------|--------|
| WebSocket gateway | `src/gateway/events.gateway.ts` | [x] |
| WebSocket module | `src/gateway/gateway.module.ts` | [x] |
| Event types | `src/gateway/events.types.ts` | [x] |
| Index exports | `src/gateway/index.ts` | [x] |

### WebSocket Events

| Event | Description | Status |
|-------|-------------|--------|
| `order_created` | New order notification to business | [x] |
| `order_status_changed` | Order status update | [x] |
| `order_cancelled` | Order cancellation | [x] |
| `courier_assigned` | Courier took the order | [x] |
| `new_order_available` | New order for couriers | [x] |

### Room Management

| Feature | Description | Status |
|---------|-------------|--------|
| Order rooms | `order:{orderId}` - track specific order | [x] |
| Business rooms | `business:{businessId}` - business notifications | [x] |
| Courier room | `couriers` - all available couriers | [x] |

### Service Integration

| Task | Description | Status |
|------|-------------|--------|
| OrderService events | Emit on create/update/cancel | [x] |
| CourierService events | Emit on take/complete | [x] |

---

## v0.4.0 - Advanced Security

> Rate limiting, enhanced auth (Planned)

### Security

| Task | File | Status |
|------|------|--------|
| Rate limiter | `src/middleware/rate-limiter.ts` | [ ] |
| Helmet security headers | `src/middleware/helmet.ts` | [ ] |
| Input sanitization | `src/middleware/sanitize.ts` | [ ] |

### Advanced Auth

| Task | File | Status |
|------|------|--------|
| Session management (Redis) | `src/auth/session.ts` | [ ] |
| Role-based access | `src/auth/rbac.ts` | [ ] |

---

## Directory Structure

```
packages/api/
├── src/
│   ├── main.ts                    # Application entry point
│   ├── app.module.ts              # Root module
│   ├── app.controller.ts          # Health/ready endpoints
│   ├── config/
│   │   └── configuration.ts       # Environment validation (Zod)
│   ├── common/
│   │   ├── logger.ts
│   │   ├── filters/
│   │   ├── interceptors/
│   │   ├── guards/
│   │   ├── decorators/
│   │   └── common.module.ts
│   ├── database/
│   │   ├── database.module.ts
│   │   └── schemas/
│   ├── cache/
│   │   ├── cache.module.ts
│   │   ├── cache.service.ts
│   │   └── cache.constants.ts
│   ├── infrastructure/
│   │   └── repositories/
│   │       └── *.repository.ts
│   ├── modules/
│   │   ├── business/
│   │   ├── product/
│   │   ├── order/
│   │   ├── courier/
│   │   ├── customer/
│   │   └── analytics/
│   └── gateway/
│       ├── events.gateway.ts
│       ├── events.types.ts
│       ├── gateway.module.ts
│       └── index.ts
└── __tests__/
    ├── controllers/
    ├── guards/
    └── services/
```

---

## Test Coverage

| Layer | Tests | Files | Coverage |
|-------|-------|-------|----------|
| Controllers | 31 | 6 | 70%+ |
| Guards | 10 | 1 | 80%+ |
| Services | 6 | 1 | 50%+ |
| **Total** | **47** | **8** | - |

---

## Performance Requirements

| Metric | Target | Status |
|--------|--------|--------|
| Response time (p95) | < 200ms | [x] |
| DB query | < 100ms | [x] |
| Memory | < 512MB | [x] |
| Concurrent connections | 1000+ | [x] |

---

## Quality Gates

Before release:
- [x] `pnpm format` - no changes
- [x] `pnpm build` - compiles
- [x] `pnpm lint` - 0 errors, 0 warnings
- [x] `pnpm test` - all pass, coverage >= 80%
- [x] Integration tests pass
