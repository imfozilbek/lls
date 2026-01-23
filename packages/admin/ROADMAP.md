# @lls/admin Roadmap

> Web Admin Panel: business dashboard for order and product management

## Overview

| Version | Focus | Depends On | Status |
|---------|-------|------------|--------|
| v0.1.0 | Dashboard & Orders | @lls/api v0.3.0 | ✅ Complete |
| v0.2.0 | Product Management | v0.1.0 | ✅ Complete |
| v0.3.0 | Analytics | v0.2.0 | ✅ Complete |
| v0.4.0 | Production Hardening | v0.3.0, @lls/api v0.5.0 | ⏳ Planned |

---

## v0.1.0 - Dashboard & Orders

> Business authentication, order management

### Project Setup

| Task | File | Status |
|------|------|--------|
| Vite + React setup | `vite.config.ts` | [x] |
| Tailwind CSS | `tailwind.config.ts` | [x] |
| Router setup | `src/App.tsx` | [x] |
| API client | `src/lib/api-client.ts` | [x] |
| Auth store | `src/stores/auth.store.ts` | [x] |

### Authentication

| Task | File | Status |
|------|------|--------|
| Login page | `src/pages/Login.tsx` | [x] |
| Telegram login button | `src/components/auth/TelegramLoginButton.tsx` | [x] |
| Auth guard (in App.tsx) | `src/App.tsx` | [x] |

### Layout

| Task | File | Status |
|------|------|--------|
| Main layout | `src/components/layout/Layout.tsx` | [x] |
| Sidebar navigation | `src/components/layout/Sidebar.tsx` | [x] |
| Header | `src/components/layout/Header.tsx` | [x] |

### Dashboard

| Task | File | Status |
|------|------|--------|
| Dashboard page | `src/pages/Dashboard.tsx` | [x] |
| Analytics stats | `src/pages/Dashboard.tsx` | [x] |
| Sales chart | `src/components/analytics/SalesChart.tsx` | [x] |
| Top products | `src/components/analytics/TopProductsList.tsx` | [x] |

### Orders Management

| Task | File | Status |
|------|------|--------|
| Orders list page | `src/pages/Orders.tsx` | [x] |
| Orders table | `src/components/orders/OrdersTable.tsx` | [x] |
| Order detail modal | `src/pages/Orders.tsx` | [x] |
| Order status update | `src/stores/orders.store.ts` | [x] |

### Common Components

| Task | File | Status |
|------|------|--------|
| Table | `src/components/ui/Table.tsx` | [x] |
| Button | `src/components/ui/Button.tsx` | [x] |
| Modal | `src/components/ui/Modal.tsx` | [x] |
| Badge | `src/components/ui/Badge.tsx` | [x] |
| Loading | `src/components/ui/Loading.tsx` | [x] |
| Card | `src/components/ui/Card.tsx` | [x] |
| Input | `src/components/ui/Input.tsx` | [x] |
| Toast | `src/components/ui/Toast.tsx` | [x] |

---

## v0.2.0 - Product Management

> Full CRUD for products and categories

### Products Page

| Task | File | Status |
|------|------|--------|
| Products list page | `src/pages/Products.tsx` | [x] |
| Products table | `src/components/products/ProductsTable.tsx` | [x] |
| Products store | `src/stores/products.store.ts` | [x] |

### Product CRUD

| Task | File | Status |
|------|------|--------|
| Product form (create/edit) | `src/components/products/ProductForm.tsx` | [x] |
| Create product | `src/pages/Products.tsx` | [x] |
| Edit product | `src/pages/Products.tsx` | [x] |
| Delete product | `src/pages/Products.tsx` | [x] |
| Toggle availability | `src/pages/Products.tsx` | [x] |

---

## v0.3.0 - Analytics

> Business statistics and reports

### Analytics Dashboard

| Task | File | Status |
|------|------|--------|
| Dashboard with analytics | `src/pages/Dashboard.tsx` | [x] |
| Period selector | `src/components/analytics/PeriodSelector.tsx` | [x] |
| Analytics store | `src/stores/analytics.store.ts` | [x] |

### Charts

| Task | File | Status |
|------|------|--------|
| Sales chart | `src/components/analytics/SalesChart.tsx` | [x] |
| Top products list | `src/components/analytics/TopProductsList.tsx` | [x] |
| Order breakdown | `src/components/analytics/OrderBreakdown.tsx` | [x] |

### Business Settings

| Task | File | Status |
|------|------|--------|
| Settings page | `src/pages/Settings.tsx` | [x] |

---

## v0.4.0 - Production Hardening

> Authentication, error handling, exports, image upload

### Environment Configuration

| Task | File | Status |
|------|------|--------|
| Create .env.example with all variables | `.env.example` | [ ] |
| Add environment validation | `src/lib/env.ts` | [ ] |

### Authentication Improvements

| Task | File | Status |
|------|------|--------|
| Verify business exists before storing telegram_id | `src/stores/auth.store.ts` | [ ] |
| Add logout functionality | `src/stores/auth.store.ts` | [ ] |
| Add logout button to header/sidebar | `src/components/layout/Header.tsx` | [ ] |
| Handle failed Telegram validation | `src/pages/Login.tsx` | [ ] |
| Use secure session storage | `src/lib/session.ts` | [ ] |

### Error Handling

| Task | File | Status |
|------|------|--------|
| Add error recovery UI for failed API calls | `src/pages/Dashboard.tsx` | [ ] |
| Add "Try Again" button on errors | `src/components/ui/ErrorState.tsx` | [ ] |
| Handle 401/403/500 errors gracefully | `src/lib/api-client.ts` | [ ] |

### Product Image Upload

| Task | File | Status |
|------|------|--------|
| Add image upload component | `src/components/ui/ImageUpload.tsx` | [ ] |
| Integrate image upload in ProductForm | `src/components/products/ProductForm.tsx` | [ ] |
| Image preview in product list | `src/components/products/ProductsTable.tsx` | [ ] |

### Performance & UX

| Task | File | Status |
|------|------|--------|
| Add pagination to Orders page | `src/pages/Orders.tsx` | [ ] |
| Add data caching | `src/lib/cache.ts` | [ ] |
| Add skeleton loaders | `src/components/ui/Skeleton.tsx` | [ ] |

### Export Features

| Task | File | Status |
|------|------|--------|
| Export orders to CSV | `src/pages/Orders.tsx` | [ ] |
| Export analytics to CSV | `src/pages/Dashboard.tsx` | [ ] |

---

## Directory Structure

```
packages/admin/
├── src/
│   ├── pages/
│   │   ├── login.tsx
│   │   ├── dashboard.tsx
│   │   ├── orders.tsx
│   │   ├── products.tsx
│   │   ├── categories.tsx
│   │   ├── analytics.tsx
│   │   └── settings.tsx
│   ├── components/
│   │   ├── ui/
│   │   └── charts/
│   ├── hooks/
│   ├── contexts/
│   ├── layouts/
│   ├── lib/
│   ├── utils/
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

### Order Flow

```
Dashboard → New Order Notification → Review Order → Accept/Reject → Mark Ready → Wait for Pickup
```

### Product Flow

```
Products → Add/Edit Product → Set Price, Category, Image → Toggle Availability
```

---

## Design Requirements

| Requirement | Details |
|-------------|---------|
| Responsive | Desktop-first, mobile-friendly |
| Theme | Light mode (dark mode optional) |
| Language | Russian (Uzbek later) |
| Accessibility | Keyboard navigation, ARIA labels |

---

## Real-time Features

| Feature | Implementation |
|---------|----------------|
| New order alert | WebSocket + Toast + Sound |
| Order status sync | WebSocket updates |
| Auto-refresh | Polling fallback |

---

## Quality Gates

Before release:
- [x] `pnpm format` - no changes
- [x] `pnpm build` - compiles
- [x] `pnpm lint` - 0 errors, 0 warnings
- [x] `pnpm test` - all pass (no test files yet)
- [x] Responsive design tested
- [x] Auth flow tested
