# @lls/bot Roadmap

> Telegram Mini App: customer and courier interfaces

## Overview

| Version | Focus | Depends On | Status |
|---------|-------|------------|--------|
| v0.1.0 | Customer Interface | @lls/api v0.3.0 | ✅ Complete |
| v0.2.0 | Courier Interface | v0.1.0 | ✅ Complete |
| v0.3.0 | Notifications | v0.2.0 | ⏳ Planned |

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

## v0.3.0 - Notifications

> Real-time updates, push notifications

### Real-time

| Task | File | Status |
|------|------|--------|
| WebSocket connection | `src/lib/websocket.ts` | [ ] |
| Order status updates | `src/hooks/use-order-updates.ts` | [ ] |
| New order alerts (courier) | `src/hooks/use-new-orders.ts` | [ ] |

### Telegram Notifications

| Task | File | Status |
|------|------|--------|
| Order confirmation message | Integration | [ ] |
| Status change notification | Integration | [ ] |
| Courier assigned notification | Integration | [ ] |
| Delivery complete notification | Integration | [ ] |

---

## Directory Structure

```
packages/bot/
├── src/
│   ├── screens/
│   │   ├── home.tsx
│   │   ├── business.tsx
│   │   ├── cart.tsx
│   │   ├── checkout.tsx
│   │   ├── orders.tsx
│   │   ├── order-detail.tsx
│   │   └── courier/
│   │       ├── available-orders.tsx
│   │       ├── active-delivery.tsx
│   │       └── earnings.tsx
│   ├── components/
│   ├── hooks/
│   ├── stores/
│   ├── lib/
│   ├── router.tsx
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
Home → Select Business → Browse Products → Add to Cart → Checkout → Track Order
```

### Courier Flow

```
Toggle Mode → Available Orders → Take Order → Navigate → Pickup → Deliver → Confirm
```

---

## Telegram Integration

| Feature | API |
|---------|-----|
| Theme colors | `window.Telegram.WebApp.themeParams` |
| Back button | `window.Telegram.WebApp.BackButton` |
| Main button | `window.Telegram.WebApp.MainButton` |
| Haptic feedback | `window.Telegram.WebApp.HapticFeedback` |
| User data | `window.Telegram.WebApp.initDataUnsafe` |
| Closing app | `window.Telegram.WebApp.close()` |

---

## Quality Gates

Before release:
- [ ] `pnpm format` - no changes
- [ ] `pnpm build` - compiles
- [ ] `pnpm lint` - 0 errors, 0 warnings
- [ ] `pnpm test` - all pass, coverage >= 70%
- [ ] Tested in Telegram (iOS + Android)
- [ ] initData validation works
