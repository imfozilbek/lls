# @lls/bot Roadmap

> Telegram Mini App: customer and courier interfaces

## Overview

| Version | Focus | Depends On | Status |
|---------|-------|------------|--------|
| v0.1.0 | Customer Interface | @lls/api v0.3.0 | ⏳ Planned |
| v0.2.0 | Courier Interface | v0.1.0 | ⏳ Planned |
| v0.3.0 | Notifications | v0.2.0 | ⏳ Planned |

---

## v0.1.0 - Customer Interface

> Browse, cart, order, track

### Project Setup

| Task | File | Status |
|------|------|--------|
| Vite + React setup | `vite.config.ts` | [ ] |
| Telegram Mini App SDK | `src/lib/telegram.ts` | [ ] |
| initData validation | `src/lib/auth.ts` | [ ] |
| API client | `src/lib/api-client.ts` | [ ] |
| Router setup | `src/router.tsx` | [ ] |
| Tailwind CSS | `tailwind.config.ts` | [ ] |

### State Management

| Task | File | Status |
|------|------|--------|
| Cart store (zustand) | `src/stores/cart-store.ts` | [ ] |
| User store | `src/stores/user-store.ts` | [ ] |
| Order store | `src/stores/order-store.ts` | [ ] |

### Screens - Browse

| Task | File | Status |
|------|------|--------|
| Home screen (business list) | `src/screens/home.tsx` | [ ] |
| Business card component | `src/components/business-card.tsx` | [ ] |
| Business filter (by type) | `src/components/business-filter.tsx` | [ ] |
| Search bar | `src/components/search-bar.tsx` | [ ] |

### Screens - Products

| Task | File | Status |
|------|------|--------|
| Business detail screen | `src/screens/business.tsx` | [ ] |
| Product list | `src/components/product-list.tsx` | [ ] |
| Product card | `src/components/product-card.tsx` | [ ] |
| Product categories | `src/components/category-tabs.tsx` | [ ] |
| Add to cart button | `src/components/add-to-cart.tsx` | [ ] |

### Screens - Cart

| Task | File | Status |
|------|------|--------|
| Cart screen | `src/screens/cart.tsx` | [ ] |
| Cart item | `src/components/cart-item.tsx` | [ ] |
| Quantity controls | `src/components/quantity-control.tsx` | [ ] |
| Cart summary | `src/components/cart-summary.tsx` | [ ] |
| Empty cart state | `src/components/empty-cart.tsx` | [ ] |

### Screens - Checkout

| Task | File | Status |
|------|------|--------|
| Checkout screen | `src/screens/checkout.tsx` | [ ] |
| Address input | `src/components/address-input.tsx` | [ ] |
| Phone input | `src/components/phone-input.tsx` | [ ] |
| Order confirmation | `src/components/order-confirm.tsx` | [ ] |
| Place order action | `src/hooks/use-place-order.ts` | [ ] |

### Screens - Orders

| Task | File | Status |
|------|------|--------|
| Order history screen | `src/screens/orders.tsx` | [ ] |
| Order card | `src/components/order-card.tsx` | [ ] |
| Order detail screen | `src/screens/order-detail.tsx` | [ ] |
| Order status badge | `src/components/status-badge.tsx` | [ ] |
| Order timeline | `src/components/order-timeline.tsx` | [ ] |

### Common Components

| Task | File | Status |
|------|------|--------|
| Bottom navigation | `src/components/bottom-nav.tsx` | [ ] |
| Loading spinner | `src/components/spinner.tsx` | [ ] |
| Error boundary | `src/components/error-boundary.tsx` | [ ] |
| Pull to refresh | `src/components/pull-refresh.tsx` | [ ] |
| Toast notifications | `src/components/toast.tsx` | [ ] |

### Hooks

| Task | File | Status |
|------|------|--------|
| useBusinesses | `src/hooks/use-businesses.ts` | [ ] |
| useProducts | `src/hooks/use-products.ts` | [ ] |
| useOrders | `src/hooks/use-orders.ts` | [ ] |
| useTelegram | `src/hooks/use-telegram.ts` | [ ] |

---

## v0.2.0 - Courier Interface

> Available orders, take order, deliver

### Mode Switching

| Task | File | Status |
|------|------|--------|
| Courier/Customer toggle | `src/components/mode-toggle.tsx` | [ ] |
| Mode store | `src/stores/mode-store.ts` | [ ] |
| Courier registration | `src/screens/courier-register.tsx` | [ ] |

### Screens - Courier

| Task | File | Status |
|------|------|--------|
| Available orders screen | `src/screens/courier/available-orders.tsx` | [ ] |
| Order map view | `src/components/order-map.tsx` | [ ] |
| Order details (courier view) | `src/screens/courier/order-detail.tsx` | [ ] |
| Take order action | `src/hooks/use-take-order.ts` | [ ] |

### Screens - Active Delivery

| Task | File | Status |
|------|------|--------|
| Active delivery screen | `src/screens/courier/active-delivery.tsx` | [ ] |
| Pickup confirmation | `src/components/pickup-confirm.tsx` | [ ] |
| Delivery confirmation | `src/components/delivery-confirm.tsx` | [ ] |
| Navigation to address | `src/components/navigation-link.tsx` | [ ] |

### Screens - Earnings

| Task | File | Status |
|------|------|--------|
| Earnings screen | `src/screens/courier/earnings.tsx` | [ ] |
| Earnings summary | `src/components/earnings-summary.tsx` | [ ] |
| Delivery history | `src/components/delivery-history.tsx` | [ ] |

### Hooks - Courier

| Task | File | Status |
|------|------|--------|
| useAvailableOrders | `src/hooks/use-available-orders.ts` | [ ] |
| useCourierOrders | `src/hooks/use-courier-orders.ts` | [ ] |
| useEarnings | `src/hooks/use-earnings.ts` | [ ] |

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
