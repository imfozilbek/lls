# @lls/core Roadmap

> Domain logic package: entities, value objects, use cases, ports

## Overview

| Version | Focus | Status |
|---------|-------|--------|
| v0.1.0 | Domain Types | ⏳ Planned |
| v0.2.0 | Use Cases | ⏳ Planned |
| v0.3.0 | Events & Validation | ⏳ Planned |

---

## v0.1.0 - Domain Types

> Foundation: entities, value objects, enums

### Value Objects

| Task | File | Status |
|------|------|--------|
| Money (amount, currency) | `src/domain/value-objects/money.ts` | [ ] |
| Address (street, city, coords) | `src/domain/value-objects/address.ts` | [ ] |
| Phone (number, validation) | `src/domain/value-objects/phone.ts` | [ ] |
| TelegramId | `src/domain/value-objects/telegram-id.ts` | [ ] |
| Unit tests | `src/domain/value-objects/*.test.ts` | [ ] |

### Enums

| Task | File | Status |
|------|------|--------|
| BusinessType (food, construction, water) | `src/domain/enums/business-type.ts` | [ ] |
| OrderStatus (pending → delivered) | `src/domain/enums/order-status.ts` | [ ] |
| Unit tests | `src/domain/enums/*.test.ts` | [ ] |

### Entities

| Task | File | Status |
|------|------|--------|
| Business entity | `src/domain/entities/business.ts` | [ ] |
| Product entity | `src/domain/entities/product.ts` | [ ] |
| Customer entity | `src/domain/entities/customer.ts` | [ ] |
| Courier entity | `src/domain/entities/courier.ts` | [ ] |
| Order entity (with items) | `src/domain/entities/order.ts` | [ ] |
| OrderItem entity | `src/domain/entities/order-item.ts` | [ ] |
| Unit tests | `src/domain/entities/*.test.ts` | [ ] |

### Ports (Interfaces)

| Task | File | Status |
|------|------|--------|
| BusinessRepository port | `src/application/ports/business-repository.ts` | [ ] |
| ProductRepository port | `src/application/ports/product-repository.ts` | [ ] |
| CustomerRepository port | `src/application/ports/customer-repository.ts` | [ ] |
| CourierRepository port | `src/application/ports/courier-repository.ts` | [ ] |
| OrderRepository port | `src/application/ports/order-repository.ts` | [ ] |

### Package Setup

| Task | File | Status |
|------|------|--------|
| package.json | `package.json` | [ ] |
| tsconfig.json | `tsconfig.json` | [ ] |
| ESLint config | `.eslintrc.js` | [ ] |
| Vitest config | `vitest.config.ts` | [ ] |
| Index exports | `src/index.ts` | [ ] |

---

## v0.2.0 - Use Cases

> Application layer: business logic orchestration

### Business Use Cases

| Task | File | Status |
|------|------|--------|
| ListBusinesses | `src/application/use-cases/business/list-businesses.ts` | [ ] |
| GetBusinessById | `src/application/use-cases/business/get-business-by-id.ts` | [ ] |
| CreateBusiness | `src/application/use-cases/business/create-business.ts` | [ ] |
| UpdateBusiness | `src/application/use-cases/business/update-business.ts` | [ ] |
| Unit tests | `src/application/use-cases/business/*.test.ts` | [ ] |

### Product Use Cases

| Task | File | Status |
|------|------|--------|
| GetBusinessProducts | `src/application/use-cases/product/get-business-products.ts` | [ ] |
| CreateProduct | `src/application/use-cases/product/create-product.ts` | [ ] |
| UpdateProduct | `src/application/use-cases/product/update-product.ts` | [ ] |
| DeleteProduct | `src/application/use-cases/product/delete-product.ts` | [ ] |
| ToggleAvailability | `src/application/use-cases/product/toggle-availability.ts` | [ ] |
| Unit tests | `src/application/use-cases/product/*.test.ts` | [ ] |

### Order Use Cases

| Task | File | Status |
|------|------|--------|
| CreateOrder | `src/application/use-cases/order/create-order.ts` | [ ] |
| GetOrderById | `src/application/use-cases/order/get-order-by-id.ts` | [ ] |
| GetBusinessOrders | `src/application/use-cases/order/get-business-orders.ts` | [ ] |
| GetCustomerOrders | `src/application/use-cases/order/get-customer-orders.ts` | [ ] |
| UpdateOrderStatus | `src/application/use-cases/order/update-order-status.ts` | [ ] |
| CancelOrder | `src/application/use-cases/order/cancel-order.ts` | [ ] |
| Unit tests | `src/application/use-cases/order/*.test.ts` | [ ] |

### Courier Use Cases

| Task | File | Status |
|------|------|--------|
| GetAvailableOrders | `src/application/use-cases/courier/get-available-orders.ts` | [ ] |
| TakeOrder | `src/application/use-cases/courier/take-order.ts` | [ ] |
| GetCourierOrders | `src/application/use-cases/courier/get-courier-orders.ts` | [ ] |
| MarkDelivered | `src/application/use-cases/courier/mark-delivered.ts` | [ ] |
| Unit tests | `src/application/use-cases/courier/*.test.ts` | [ ] |

---

## v0.3.0 - Events & Validation

> Domain events, advanced validation

### Domain Events

| Task | File | Status |
|------|------|--------|
| Event base class | `src/domain/events/domain-event.ts` | [ ] |
| OrderCreated event | `src/domain/events/order-created.ts` | [ ] |
| OrderStatusChanged event | `src/domain/events/order-status-changed.ts` | [ ] |
| CourierAssigned event | `src/domain/events/courier-assigned.ts` | [ ] |
| Event dispatcher | `src/domain/events/event-dispatcher.ts` | [ ] |
| Unit tests | `src/domain/events/*.test.ts` | [ ] |

### Validation

| Task | File | Status |
|------|------|--------|
| Order status transition rules | `src/domain/rules/order-status-rules.ts` | [ ] |
| Business hours validation | `src/domain/rules/business-hours.ts` | [ ] |
| Order total calculation | `src/domain/services/order-calculator.ts` | [ ] |
| Unit tests | `src/domain/rules/*.test.ts` | [ ] |

---

## Directory Structure

```
packages/core/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── enums/
│   │   ├── events/
│   │   ├── rules/
│   │   └── services/
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── business/
│   │   │   ├── product/
│   │   │   ├── order/
│   │   │   └── courier/
│   │   └── ports/
│   └── index.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Quality Gates

Before release:
- [ ] `pnpm format` - no changes
- [ ] `pnpm build` - compiles
- [ ] `pnpm lint` - 0 errors, 0 warnings
- [ ] `pnpm test` - all pass, coverage >= 90%
