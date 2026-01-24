# @lls/bot Roadmap

> Telegram Mini App: customer and courier interfaces

## Overview

| Version | Focus | Depends On | Status |
|---------|-------|------------|--------|
| v0.1.0 | Customer Interface | @lls/api v0.3.0 | ✅ Complete |
| v0.2.0 | Courier Interface | v0.1.0 | ✅ Complete |
| v0.3.0 | Real-time Updates | v0.2.0 | ✅ Complete |
| v0.4.0 | Push Notifications | v0.3.0 | ✅ Complete |
| v0.5.0 | Production Hardening | v0.4.0, @lls/api v0.5.0 | ⏳ Planned |

---

## v0.1.0 - Customer Interface

> Browse, cart, order, track

### Project Setup

| Task | File | Status |
|------|------|--------|
| Vite + React setup | `vite.config.ts` | [x] |
| Telegram Mini App SDK | `src/lib/telegram.ts` | [x] |
| initData validation | `src/stores/auth.store.ts` | [x] |
| API client | `src/lib/api-client.ts` | [x] |
| Router setup | `src/App.tsx` | [x] |
| Tailwind CSS | `tailwind.config.ts` | [x] |

### State Management

| Task | File | Status |
|------|------|--------|
| Cart store (zustand) | `src/stores/cart.store.ts` | [x] |
| Auth store | `src/stores/auth.store.ts` | [x] |
| Order store | `src/stores/order.store.ts` | [x] |
| Toast store | `src/stores/toast.store.ts` | [x] |

### Screens - Browse

| Task | File | Status |
|------|------|--------|
| Home screen (business list) | `src/screens/customer/Home.tsx` | [x] |
| Business card component | `src/components/business/BusinessCard.tsx` | [x] |
| Business list component | `src/components/business/BusinessList.tsx` | [x] |
| Search bar | `src/components/ui/SearchInput.tsx` | [x] |

### Screens - Products

| Task | File | Status |
|------|------|--------|
| Business detail screen | `src/screens/customer/Business.tsx` | [x] |
| Product list | `src/components/product/ProductList.tsx` | [x] |
| Product card | `src/components/product/ProductCard.tsx` | [x] |
| Add to cart (in ProductCard) | `src/components/product/ProductCard.tsx` | [x] |

### Screens - Cart

| Task | File | Status |
|------|------|--------|
| Cart screen | `src/screens/customer/Cart.tsx` | [x] |
| Cart item | `src/components/cart/CartItem.tsx` | [x] |
| Cart summary | `src/components/cart/CartSummary.tsx` | [x] |
| Cart button (floating) | `src/components/cart/CartButton.tsx` | [x] |

### Screens - Checkout

| Task | File | Status |
|------|------|--------|
| Checkout screen | `src/screens/customer/Checkout.tsx` | [x] |
| Address/phone inputs | `src/screens/customer/Checkout.tsx` | [x] |
| Order placement | `src/screens/customer/Checkout.tsx` | [x] |

### Screens - Orders

| Task | File | Status |
|------|------|--------|
| Order history screen | `src/screens/customer/Orders.tsx` | [x] |
| Order card | `src/components/order/OrderCard.tsx` | [x] |
| Order tracking screen | `src/screens/customer/OrderTracking.tsx` | [x] |
| Order timeline | `src/components/order/OrderTimeline.tsx` | [x] |

### Common Components

| Task | File | Status |
|------|------|--------|
| Bottom navigation | `src/components/layout/BottomNav.tsx` | [x] |
| Header | `src/components/layout/Header.tsx` | [x] |
| Layout | `src/components/layout/Layout.tsx` | [x] |
| Loading spinner | `src/components/ui/Loading.tsx` | [x] |
| Error boundary | `src/components/ErrorBoundary.tsx` | [x] |
| Toast notifications | `src/components/ui/Toast.tsx` | [x] |
| Button | `src/components/ui/Button.tsx` | [x] |
| Card | `src/components/ui/Card.tsx` | [x] |
| Input | `src/components/ui/Input.tsx` | [x] |
| Modal | `src/components/ui/Modal.tsx` | [x] |
| Badge | `src/components/ui/Badge.tsx` | [x] |

### Hooks

| Task | File | Status |
|------|------|--------|
| useApi (all API calls) | `src/hooks/useApi.ts` | [x] |
| useCart | `src/hooks/useCart.ts` | [x] |
| useTelegram | `src/hooks/useTelegram.ts` | [x] |

---

## v0.2.0 - Courier Interface

> Available orders, take order, deliver

### State Management

| Task | File | Status |
|------|------|--------|
| Courier store | `src/stores/courier.store.ts` | [x] |

### Screens - Courier

| Task | File | Status |
|------|------|--------|
| Available orders screen | `src/screens/courier/AvailableOrders.tsx` | [x] |
| Active delivery screen | `src/screens/courier/ActiveDelivery.tsx` | [x] |
| Delivery history screen | `src/screens/courier/DeliveryHistory.tsx` | [x] |

### Screens - Earnings / Delivery History

| Task | File | Status |
|------|------|--------|
| Delivery history screen | `src/screens/courier/DeliveryHistory.tsx` | [x] |
| Earnings summary | `src/screens/courier/DeliveryHistory.tsx` | [x] |
| Delivery history list | `src/screens/courier/DeliveryHistory.tsx` | [x] |

---

## v0.3.0 - Real-time Updates

> WebSocket connection for live order updates

### WebSocket Client

| Task | File | Status |
|------|------|--------|
| WebSocket client class | `src/lib/websocket.ts` | [x] |
| Connection management | `src/lib/websocket.ts` | [x] |
| Room management | `src/lib/websocket.ts` | [x] |
| Event types | `src/lib/websocket.ts` | [x] |

### Real-time Hooks

| Task | File | Status |
|------|------|--------|
| Order status updates hook | `src/hooks/useOrderUpdates.ts` | [x] |
| New order alerts hook (courier) | `src/hooks/useNewOrders.ts` | [x] |

### Integration

| Task | File | Status |
|------|------|--------|
| OrderTracking real-time updates | `src/screens/customer/OrderTracking.tsx` | [x] |
| Courier new order notifications | `src/screens/courier/AvailableOrders.tsx` | [x] |

---

## v0.4.0 - Push Notifications

> Telegram bot notifications via API

### Telegram Notifications

| Task | File | Status |
|------|------|--------|
| Notification service | `@lls/api: src/notifications/telegram-notification.service.ts` | [x] |
| Order confirmation message | `TelegramNotificationService.sendOrderConfirmation()` | [x] |
| Status change notification | `TelegramNotificationService.sendStatusChangeNotification()` | [x] |
| Courier assigned notification | `TelegramNotificationService.sendCourierAssignedNotification()` | [x] |
| Delivery complete notification | `TelegramNotificationService.sendDeliveryCompleteNotification()` | [x] |
| New order notification (business) | `TelegramNotificationService.sendNewOrderNotification()` | [x] |
| New order available (courier) | `TelegramNotificationService.sendNewOrderAvailableNotification()` | [x] |

### Integration

| Task | File | Status |
|------|------|--------|
| OrderService notification integration | `@lls/api: src/modules/order/order.service.ts` | [x] |
| CourierService notification integration | `@lls/api: src/modules/courier/courier.service.ts` | [x] |

---

## v0.5.0 - Production Hardening

> Error handling, reconnection, environment config

### Environment Configuration

| Task | File | Status |
|------|------|--------|
| Create .env.example with all variables | `.env.example` | [x] |
| Add environment validation | `src/lib/env.ts` | [x] |
| Production/dev mode detection | `src/lib/env.ts` | [x] |

### Error Handling

| Task | File | Status |
|------|------|--------|
| Add 404 Not Found screen | `src/screens/NotFound.tsx` | [ ] |
| Add generic Error screen | `src/screens/Error.tsx` | [ ] |
| Handle 401 errors - typed ApiError | `src/lib/api-client.ts` | [x] |
| Handle 403 errors - typed ApiError | `src/lib/api-client.ts` | [x] |
| Handle 500 errors - typed ApiError | `src/lib/api-client.ts` | [x] |
| Add try-catch to all API calls in screens | `src/screens/**/*.tsx` | [ ] |

### WebSocket Resilience

| Task | File | Status |
|------|------|--------|
| Add automatic reconnection with backoff | `src/lib/websocket.ts` | [x] |
| Add connection status indicator | `src/components/ui/ConnectionStatus.tsx` | [ ] |
| Clean up event listeners on unmount | `src/hooks/useOrderUpdates.ts` | [ ] |
| Clean up event listeners on unmount | `src/hooks/useNewOrders.ts` | [ ] |

### Logging & Debugging

| Task | File | Status |
|------|------|--------|
| Replace console.log with proper logger | `src/lib/logger.ts` | [x] |
| Remove all console.warn/error from production | `src/lib/websocket.ts` | [x] |
| Remove all console.error from production | `src/lib/telegram.ts` | [x] |

### Loading States

| Task | File | Status |
|------|------|--------|
| Add skeleton loaders to Home screen | `src/screens/customer/Home.tsx` | [ ] |
| Add skeleton loaders to Business screen | `src/screens/customer/Business.tsx` | [ ] |
| Add skeleton loaders to Orders screen | `src/screens/customer/Orders.tsx` | [ ] |

---

## Directory Structure

```
packages/bot/
├── src/
│   ├── screens/
│   │   ├── customer/
│   │   │   ├── Home.tsx
│   │   │   ├── Business.tsx
│   │   │   ├── Cart.tsx
│   │   │   ├── Checkout.tsx
│   │   │   ├── Orders.tsx
│   │   │   └── OrderTracking.tsx
│   │   └── courier/
│   │       ├── AvailableOrders.tsx
│   │       ├── ActiveDelivery.tsx
│   │       └── DeliveryHistory.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── business/
│   │   ├── product/
│   │   ├── cart/
│   │   └── order/
│   ├── hooks/
│   │   ├── useApi.ts
│   │   ├── useCart.ts
│   │   ├── useTelegram.ts
│   │   ├── useOrderUpdates.ts
│   │   └── useNewOrders.ts
│   ├── stores/
│   │   ├── auth.store.ts
│   │   ├── cart.store.ts
│   │   ├── order.store.ts
│   │   ├── courier.store.ts
│   │   └── toast.store.ts
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── telegram.ts
│   │   ├── utils.ts
│   │   └── websocket.ts
│   ├── App.tsx
│   └── main.tsx
├── public/
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.ts
```

---

## User Flows

### Customer Flow

```
Home → Select Business → Browse Products → Add to Cart → Checkout → Track Order (real-time)
```

### Courier Flow

```
Toggle Mode → Available Orders (real-time) → Take Order → Navigate → Pickup → Deliver → Confirm
```

---

## Telegram Integration

| Feature | API | Status |
|---------|-----|--------|
| Theme colors | `window.Telegram.WebApp.themeParams` | [x] |
| Back button | `window.Telegram.WebApp.BackButton` | [x] |
| Main button | `window.Telegram.WebApp.MainButton` | [x] |
| Haptic feedback | `window.Telegram.WebApp.HapticFeedback` | [x] |
| User data | `window.Telegram.WebApp.initDataUnsafe` | [x] |
| Closing app | `window.Telegram.WebApp.close()` | [x] |

---

## Real-time Events

| Event | Description | Status |
|-------|-------------|--------|
| `order_status_changed` | Order status updates | [x] |
| `order_created` | New order for business | [x] |
| `order_cancelled` | Order cancelled | [x] |
| `courier_assigned` | Courier took order | [x] |
| `new_order_available` | New order for couriers | [x] |

---

## Quality Gates

Before release:
- [x] `pnpm format` - no changes
- [x] `pnpm build` - compiles
- [x] `pnpm lint` - 0 errors, 0 warnings
- [x] `pnpm test` - all pass (no test files yet)
- [x] Tested in Telegram (iOS + Android)
- [x] initData validation works
