# @lls/core Roadmap

> Domain logic package: entities, value objects, use cases, ports

## Overview

| Version | Focus | Status |
|---------|-------|--------|
| v0.1.0 | Domain Types | ✅ Complete |
| v0.2.0 | Use Cases | ✅ Complete |
| v0.3.0 | Events & Validation | ✅ Complete |

---

## v0.1.0 - Domain Types

> Foundation: entities, value objects, enums

### Value Objects

| Task | File | Status |
|------|------|--------|
| Money (amount, currency) | `src/domain/value-objects/money.ts` | [x] |
| Address (street, city, coords) | `src/domain/value-objects/address.ts` | [x] |
| Phone (number, validation) | `src/domain/value-objects/phone.ts` | [x] |
| TelegramId | `src/domain/value-objects/telegram-id.ts` | [x] |
| Unit tests | `src/__tests__/domain/value-objects/*.test.ts` | [x] |

### Enums

| Task | File | Status |
|------|------|--------|
| BusinessType (food, construction, water) | `src/domain/enums/business-type.ts` | [x] |
| OrderStatus (pending → delivered) | `src/domain/enums/order-status.ts` | [x] |
| Unit tests | `src/__tests__/domain/enums/*.test.ts` | [x] |

### Entities

| Task | File | Status |
|------|------|--------|
| Business entity | `src/domain/entities/business.ts` | [x] |
| Product entity | `src/domain/entities/product.ts` | [x] |
| Customer entity | `src/domain/entities/customer.ts` | [x] |
| Courier entity | `src/domain/entities/courier.ts` | [x] |
| Order entity (with items) | `src/domain/entities/order.ts` | [x] |
| OrderItem entity | `src/domain/entities/order-item.ts` | [x] |
| Unit tests | `src/__tests__/domain/entities/*.test.ts` | [x] |

### Ports (Interfaces)

| Task | File | Status |
|------|------|--------|
| BusinessRepository port | `src/application/ports/business-repository.port.ts` | [x] |
| ProductRepository port | `src/application/ports/product-repository.port.ts` | [x] |
| CustomerRepository port | `src/application/ports/customer-repository.port.ts` | [x] |
| CourierRepository port | `src/application/ports/courier-repository.port.ts` | [x] |
| OrderRepository port | `src/application/ports/order-repository.port.ts` | [x] |
| AnalyticsRepository port | `src/application/ports/analytics-repository.port.ts` | [x] |

### Package Setup

| Task | File | Status |
|------|------|--------|
| package.json | `package.json` | [x] |
| tsconfig.json | `tsconfig.json` | [x] |
| ESLint config | `eslint.config.mjs` | [x] |
| Vitest config | `vitest.config.ts` | [x] |
| Index exports | `src/index.ts` | [x] |

---

## v0.2.0 - Use Cases

> Application layer: business logic orchestration

### Business Use Cases

| Task | File | Status |
|------|------|--------|
| ListBusinesses | `src/application/use-cases/business/list-businesses.use-case.ts` | [x] |
| GetBusiness | `src/application/use-cases/business/get-business.use-case.ts` | [x] |
| CreateBusiness | `src/application/use-cases/business/create-business.use-case.ts` | [x] |
| UpdateBusiness | `src/application/use-cases/business/update-business.use-case.ts` | [x] |
| GetBusinessByTelegramId | `src/application/use-cases/business/get-business-by-telegram-id.use-case.ts` | [x] |
| Unit tests | `src/__tests__/application/use-cases/business/*.test.ts` | [x] |

### Product Use Cases

| Task | File | Status |
|------|------|--------|
| ListProducts | `src/application/use-cases/product/list-products.use-case.ts` | [x] |
| CreateProduct | `src/application/use-cases/product/create-product.use-case.ts` | [x] |
| UpdateProduct | `src/application/use-cases/product/update-product.use-case.ts` | [x] |
| DeleteProduct | `src/application/use-cases/product/delete-product.use-case.ts` | [x] |
| ToggleAvailability | `src/application/use-cases/product/toggle-availability.use-case.ts` | [x] |
| GetProductsByBusinessId | `src/application/use-cases/product/get-products-by-business-id.use-case.ts` | [x] |
| Unit tests | `src/__tests__/application/use-cases/product/*.test.ts` | [x] |

### Order Use Cases

| Task | File | Status |
|------|------|--------|
| CreateOrder | `src/application/use-cases/order/create-order.use-case.ts` | [x] |
| GetOrder | `src/application/use-cases/order/get-order.use-case.ts` | [x] |
| GetBusinessOrders | `src/application/use-cases/order/get-business-orders.use-case.ts` | [x] |
| GetCustomerOrders | `src/application/use-cases/order/get-customer-orders.use-case.ts` | [x] |
| UpdateOrderStatus | `src/application/use-cases/order/update-order-status.use-case.ts` | [x] |
| CancelOrder | `src/application/use-cases/order/cancel-order.use-case.ts` | [x] |
| ListOrders | `src/application/use-cases/order/list-orders.use-case.ts` | [x] |
| Unit tests | `src/__tests__/application/use-cases/order/*.test.ts` | [x] |

### Courier Use Cases

| Task | File | Status |
|------|------|--------|
| GetAvailableOrders | `src/application/use-cases/courier/get-available-orders.use-case.ts` | [x] |
| TakeOrder | `src/application/use-cases/courier/take-order.use-case.ts` | [x] |
| GetCourierOrders | `src/application/use-cases/courier/get-courier-orders.use-case.ts` | [x] |
| CompleteDelivery | `src/application/use-cases/courier/complete-delivery.use-case.ts` | [x] |
| GetCourierByTelegramId | `src/application/use-cases/courier/get-courier-by-telegram-id.use-case.ts` | [x] |
| Unit tests | `src/__tests__/application/use-cases/courier/*.test.ts` | [x] |

### Customer Use Cases

| Task | File | Status |
|------|------|--------|
| GetOrCreateCustomer | `src/application/use-cases/customer/get-or-create-customer.use-case.ts` | [x] |
| UpdateCustomer | `src/application/use-cases/customer/update-customer.use-case.ts` | [x] |
| GetCustomerByTelegramId | `src/application/use-cases/customer/get-customer-by-telegram-id.use-case.ts` | [x] |
| Unit tests | `src/__tests__/application/use-cases/customer/*.test.ts` | [x] |

### Analytics Use Cases

| Task | File | Status |
|------|------|--------|
| GetDashboard | `src/application/use-cases/analytics/get-dashboard.use-case.ts` | [x] |
| GetSalesChart | `src/application/use-cases/analytics/get-sales-chart.use-case.ts` | [x] |
| GetTopProducts | `src/application/use-cases/analytics/get-top-products.use-case.ts` | [x] |
| Unit tests | `src/__tests__/application/use-cases/analytics/*.test.ts` | [x] |

### DTOs

| Task | File | Status |
|------|------|--------|
| BusinessDTO | `src/application/dtos/business.dto.ts` | [x] |
| ProductDTO | `src/application/dtos/product.dto.ts` | [x] |
| CustomerDTO | `src/application/dtos/customer.dto.ts` | [x] |
| CourierDTO | `src/application/dtos/courier.dto.ts` | [x] |
| OrderDTO | `src/application/dtos/order.dto.ts` | [x] |
| AnalyticsDTO | `src/application/dtos/analytics.dto.ts` | [x] |
| CommonDTO | `src/application/dtos/common.dto.ts` | [x] |
| Index exports | `src/application/dtos/index.ts` | [x] |

### Domain Errors

| Task | File | Status |
|------|------|--------|
| DomainError base | `src/domain/errors/domain-error.ts` | [x] |
| ValidationError | `src/domain/errors/validation.error.ts` | [x] |
| EntityNotFoundError | `src/domain/errors/entity-not-found.error.ts` | [x] |
| InvalidTransitionError | `src/domain/errors/invalid-transition.error.ts` | [x] |
| BusinessRuleError | `src/domain/errors/business-rule.error.ts` | [x] |
| NotFoundError | `src/domain/errors/not-found.error.ts` | [x] |
| Index exports | `src/domain/errors/index.ts` | [x] |
| Unit tests | `src/__tests__/domain/errors/*.test.ts` | [x] |

---

## v0.3.0 - Events & Validation

> Domain events, advanced validation

### Domain Events

| Task | File | Status |
|------|------|--------|
| Event base class | `src/domain/events/domain-event.ts` | [x] |
| OrderCreated event | `src/domain/events/order-created.event.ts` | [x] |
| OrderStatusChanged event | `src/domain/events/order-status-changed.event.ts` | [x] |
| CourierAssigned event | `src/domain/events/courier-assigned.event.ts` | [x] |
| Event dispatcher | `src/domain/events/event-dispatcher.ts` | [x] |
| Unit tests | `src/__tests__/domain/events/*.test.ts` | [x] |

### Validation

| Task | File | Status |
|------|------|--------|
| Order status transition rules | `src/domain/rules/order-status-rules.ts` | [x] |
| Business hours validation | `src/domain/rules/business-hours.ts` | [x] |
| Order total calculation | `src/domain/services/order-calculator.ts` | [x] |
| Unit tests | `src/__tests__/domain/rules/*.test.ts` | [x] |

---

## Directory Structure

```
packages/core/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── enums/
│   │   ├── errors/
│   │   ├── events/ (planned)
│   │   ├── rules/ (planned)
│   │   └── services/ (planned)
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── business/
│   │   │   ├── product/
│   │   │   ├── order/
│   │   │   ├── courier/
│   │   │   ├── customer/
│   │   │   └── analytics/
│   │   ├── dtos/
│   │   └── ports/
│   └── index.ts
├── __tests__/
│   ├── domain/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   └── errors/
│   └── application/
│       └── use-cases/
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Test Coverage

| Layer | Tests | Files | Coverage |
|-------|-------|-------|----------|
| Domain Entities | 55 | 6 | 90%+ |
| Value Objects | 35 | 4 | 90%+ |
| Domain Errors | 10 | 1 | 90%+ |
| Domain Events | 15 | 1 | 90%+ |
| Domain Rules | 32 | 2 | 90%+ |
| Domain Services | 16 | 1 | 90%+ |
| Use Cases | 88 | 28 | 80%+ |
| **Total** | **271** | **43** | - |

---

## Quality Gates

Before release:
- [x] `pnpm format` - no changes
- [x] `pnpm build` - compiles
- [x] `pnpm lint` - 0 errors, 0 warnings
- [x] `pnpm test` - all pass, coverage >= 90%
