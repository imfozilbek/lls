# @lls/api Roadmap

> Fastify REST API: endpoints, middleware, adapters

## Overview

| Version | Focus | Depends On | Status |
|---------|-------|------------|--------|
| v0.1.0 | Infrastructure | @lls/core v0.1.0 | ⏳ Planned |
| v0.2.0 | Business & Product API | @lls/core v0.2.0 | ⏳ Planned |
| v0.3.0 | Order & Courier API | v0.2.0 | ⏳ Planned |
| v0.4.0 | Auth & Security | v0.3.0 | ⏳ Planned |

---

## v0.1.0 - Infrastructure Setup

> Foundation: Fastify, MongoDB, Redis, logging

### Server Setup

| Task | File | Status |
|------|------|--------|
| Fastify app factory | `src/app.ts` | [ ] |
| Server entry point | `src/server.ts` | [ ] |
| Environment config | `src/config/env.ts` | [ ] |
| Graceful shutdown | `src/server.ts` | [ ] |

### Database

| Task | File | Status |
|------|------|--------|
| MongoDB connection | `src/infrastructure/database/mongodb.ts` | [ ] |
| Mongoose models | `src/infrastructure/database/models/*.ts` | [ ] |
| Redis connection | `src/infrastructure/cache/redis.ts` | [ ] |
| Connection health check | `src/infrastructure/database/health.ts` | [ ] |

### Middleware

| Task | File | Status |
|------|------|--------|
| Error handler | `src/middleware/error-handler.ts` | [ ] |
| Request logger | `src/middleware/request-logger.ts` | [ ] |
| CORS setup | `src/middleware/cors.ts` | [ ] |
| Request ID | `src/middleware/request-id.ts` | [ ] |

### Utilities

| Task | File | Status |
|------|------|--------|
| Logger (pino) | `src/utils/logger.ts` | [ ] |
| Response helpers | `src/utils/response.ts` | [ ] |
| Validation schemas | `src/utils/validation.ts` | [ ] |

### Endpoints

| Task | Route | Status |
|------|-------|--------|
| Health check | `GET /health` | [ ] |
| Ready check | `GET /ready` | [ ] |

### Package Setup

| Task | File | Status |
|------|------|--------|
| package.json | `package.json` | [ ] |
| tsconfig.json | `tsconfig.json` | [ ] |
| ESLint config | `.eslintrc.js` | [ ] |
| Vitest config | `vitest.config.ts` | [ ] |
| .env.example | `.env.example` | [ ] |

---

## v0.2.0 - Business & Product API

> CRUD for businesses and products

### Repository Adapters

| Task | File | Status |
|------|------|--------|
| BusinessRepository (MongoDB) | `src/infrastructure/repositories/business-repository.ts` | [ ] |
| ProductRepository (MongoDB) | `src/infrastructure/repositories/product-repository.ts` | [ ] |
| Unit tests | `src/infrastructure/repositories/*.test.ts` | [ ] |

### Business Endpoints

| Task | Route | Status |
|------|-------|--------|
| List businesses | `GET /api/businesses` | [ ] |
| Get business | `GET /api/businesses/:id` | [ ] |
| Create business | `POST /api/businesses` | [ ] |
| Update business | `PATCH /api/businesses/:id` | [ ] |
| Integration tests | `tests/integration/business.test.ts` | [ ] |

### Product Endpoints

| Task | Route | Status |
|------|-------|--------|
| Get business products | `GET /api/businesses/:id/products` | [ ] |
| Create product | `POST /api/products` | [ ] |
| Update product | `PATCH /api/products/:id` | [ ] |
| Delete product | `DELETE /api/products/:id` | [ ] |
| Toggle availability | `PATCH /api/products/:id/availability` | [ ] |
| Integration tests | `tests/integration/product.test.ts` | [ ] |

### Controllers

| Task | File | Status |
|------|------|--------|
| BusinessController | `src/controllers/business-controller.ts` | [ ] |
| ProductController | `src/controllers/product-controller.ts` | [ ] |

### Documentation

| Task | File | Status |
|------|------|--------|
| Swagger/OpenAPI setup | `src/plugins/swagger.ts` | [ ] |
| Business schemas | `src/schemas/business.ts` | [ ] |
| Product schemas | `src/schemas/product.ts` | [ ] |

---

## v0.3.0 - Order & Courier API

> Order lifecycle, courier assignment

### Repository Adapters

| Task | File | Status |
|------|------|--------|
| OrderRepository (MongoDB) | `src/infrastructure/repositories/order-repository.ts` | [ ] |
| CourierRepository (MongoDB) | `src/infrastructure/repositories/courier-repository.ts` | [ ] |
| CustomerRepository (MongoDB) | `src/infrastructure/repositories/customer-repository.ts` | [ ] |
| Unit tests | `src/infrastructure/repositories/*.test.ts` | [ ] |

### Order Endpoints

| Task | Route | Status |
|------|-------|--------|
| Create order | `POST /api/orders` | [ ] |
| Get order | `GET /api/orders/:id` | [ ] |
| Update status | `PATCH /api/orders/:id/status` | [ ] |
| Get business orders | `GET /api/orders/business/:id` | [ ] |
| Get customer orders | `GET /api/orders/customer/:id` | [ ] |
| Cancel order | `POST /api/orders/:id/cancel` | [ ] |
| Integration tests | `tests/integration/order.test.ts` | [ ] |

### Courier Endpoints

| Task | Route | Status |
|------|-------|--------|
| Get available orders | `GET /api/couriers/available-orders` | [ ] |
| Take order | `POST /api/couriers/take-order/:id` | [ ] |
| Get courier orders | `GET /api/orders/courier/:id` | [ ] |
| Mark picked up | `PATCH /api/orders/:id/pickup` | [ ] |
| Mark delivered | `PATCH /api/orders/:id/deliver` | [ ] |
| Integration tests | `tests/integration/courier.test.ts` | [ ] |

### Controllers

| Task | File | Status |
|------|------|--------|
| OrderController | `src/controllers/order-controller.ts` | [ ] |
| CourierController | `src/controllers/courier-controller.ts` | [ ] |

---

## v0.4.0 - Auth & Security

> Telegram auth, rate limiting, security

### Authentication

| Task | File | Status |
|------|------|--------|
| Telegram initData validation | `src/auth/telegram-validator.ts` | [ ] |
| Auth middleware | `src/middleware/auth.ts` | [ ] |
| Session management (Redis) | `src/auth/session.ts` | [ ] |
| Unit tests | `src/auth/*.test.ts` | [ ] |

### Authorization

| Task | File | Status |
|------|------|--------|
| Role-based access | `src/auth/rbac.ts` | [ ] |
| Business owner guard | `src/guards/business-owner.ts` | [ ] |
| Courier guard | `src/guards/courier.ts` | [ ] |

### Security

| Task | File | Status |
|------|------|--------|
| Rate limiter | `src/middleware/rate-limiter.ts` | [ ] |
| Helmet security headers | `src/middleware/helmet.ts` | [ ] |
| Input sanitization | `src/middleware/sanitize.ts` | [ ] |

---

## Directory Structure

```
packages/api/
├── src/
│   ├── controllers/
│   ├── middleware/
│   ├── infrastructure/
│   │   ├── database/
│   │   ├── cache/
│   │   └── repositories/
│   ├── auth/
│   ├── guards/
│   ├── schemas/
│   ├── plugins/
│   ├── utils/
│   ├── config/
│   ├── app.ts
│   └── server.ts
├── tests/
│   ├── integration/
│   └── helpers/
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Performance Requirements

| Metric | Target |
|--------|--------|
| Response time (p95) | < 200ms |
| DB query | < 100ms |
| Memory | < 512MB |
| Concurrent connections | 1000+ |

---

## Quality Gates

Before release:
- [ ] `pnpm format` - no changes
- [ ] `pnpm build` - compiles
- [ ] `pnpm lint` - 0 errors, 0 warnings
- [ ] `pnpm test` - all pass, coverage >= 80%
- [ ] Integration tests pass
- [ ] Swagger docs generated
