# @lls/admin Roadmap

> Web Admin Panel: business dashboard for order and product management

## Overview

| Version | Focus | Depends On | Status |
|---------|-------|------------|--------|
| v0.1.0 | Dashboard & Orders | @lls/api v0.3.0 | ⏳ Planned |
| v0.2.0 | Product Management | v0.1.0 | ⏳ Planned |
| v0.3.0 | Analytics | v0.2.0 | ⏳ Planned |

---

## v0.1.0 - Dashboard & Orders

> Business authentication, order management

### Project Setup

| Task | File | Status |
|------|------|--------|
| Vite + React setup | `vite.config.ts` | [ ] |
| Tailwind CSS | `tailwind.config.ts` | [ ] |
| Router setup | `src/router.tsx` | [ ] |
| API client | `src/lib/api-client.ts` | [ ] |
| Auth context | `src/contexts/auth-context.tsx` | [ ] |

### Authentication

| Task | File | Status |
|------|------|--------|
| Login page | `src/pages/login.tsx` | [ ] |
| Telegram login widget | `src/components/telegram-login.tsx` | [ ] |
| Auth guard | `src/components/auth-guard.tsx` | [ ] |
| Session storage | `src/lib/session.ts` | [ ] |

### Layout

| Task | File | Status |
|------|------|--------|
| Main layout | `src/layouts/main-layout.tsx` | [ ] |
| Sidebar navigation | `src/components/sidebar.tsx` | [ ] |
| Header | `src/components/header.tsx` | [ ] |
| Mobile menu | `src/components/mobile-menu.tsx` | [ ] |

### Dashboard

| Task | File | Status |
|------|------|--------|
| Dashboard page | `src/pages/dashboard.tsx` | [ ] |
| Stats cards (orders today, revenue) | `src/components/stats-cards.tsx` | [ ] |
| Recent orders widget | `src/components/recent-orders.tsx` | [ ] |
| Quick actions | `src/components/quick-actions.tsx` | [ ] |

### Orders Management

| Task | File | Status |
|------|------|--------|
| Orders list page | `src/pages/orders.tsx` | [ ] |
| Orders table | `src/components/orders-table.tsx` | [ ] |
| Order filters (status, date) | `src/components/order-filters.tsx` | [ ] |
| Order detail modal | `src/components/order-detail-modal.tsx` | [ ] |
| Accept order action | `src/hooks/use-accept-order.ts` | [ ] |
| Reject order action | `src/hooks/use-reject-order.ts` | [ ] |
| Mark ready action | `src/hooks/use-mark-ready.ts` | [ ] |

### Order States

| Task | File | Status |
|------|------|--------|
| Pending orders tab | `src/components/pending-orders.tsx` | [ ] |
| Active orders tab | `src/components/active-orders.tsx` | [ ] |
| Completed orders tab | `src/components/completed-orders.tsx` | [ ] |
| Order status update | `src/hooks/use-update-status.ts` | [ ] |

### Common Components

| Task | File | Status |
|------|------|--------|
| Data table | `src/components/ui/data-table.tsx` | [ ] |
| Button | `src/components/ui/button.tsx` | [ ] |
| Modal | `src/components/ui/modal.tsx` | [ ] |
| Badge | `src/components/ui/badge.tsx` | [ ] |
| Spinner | `src/components/ui/spinner.tsx` | [ ] |
| Toast | `src/components/ui/toast.tsx` | [ ] |

---

## v0.2.0 - Product Management

> Full CRUD for products and categories

### Products Page

| Task | File | Status |
|------|------|--------|
| Products list page | `src/pages/products.tsx` | [ ] |
| Products table | `src/components/products-table.tsx` | [ ] |
| Product search | `src/components/product-search.tsx` | [ ] |
| Category filter | `src/components/category-filter.tsx` | [ ] |

### Product CRUD

| Task | File | Status |
|------|------|--------|
| Create product modal | `src/components/create-product-modal.tsx` | [ ] |
| Edit product modal | `src/components/edit-product-modal.tsx` | [ ] |
| Product form | `src/components/product-form.tsx` | [ ] |
| Delete confirmation | `src/components/delete-confirm.tsx` | [ ] |
| useProducts hook | `src/hooks/use-products.ts` | [ ] |

### Product Details

| Task | File | Status |
|------|------|--------|
| Price input | `src/components/price-input.tsx` | [ ] |
| Availability toggle | `src/components/availability-toggle.tsx` | [ ] |
| Image upload | `src/components/image-upload.tsx` | [ ] |
| Image preview | `src/components/image-preview.tsx` | [ ] |

### Categories

| Task | File | Status |
|------|------|--------|
| Categories page | `src/pages/categories.tsx` | [ ] |
| Category list | `src/components/category-list.tsx` | [ ] |
| Create category | `src/components/create-category.tsx` | [ ] |
| Edit category | `src/components/edit-category.tsx` | [ ] |
| Reorder categories | `src/components/category-reorder.tsx` | [ ] |

### Bulk Actions

| Task | File | Status |
|------|------|--------|
| Multi-select products | `src/components/multi-select.tsx` | [ ] |
| Bulk availability toggle | `src/hooks/use-bulk-toggle.ts` | [ ] |
| Bulk delete | `src/hooks/use-bulk-delete.ts` | [ ] |

---

## v0.3.0 - Analytics

> Business statistics and reports

### Analytics Dashboard

| Task | File | Status |
|------|------|--------|
| Analytics page | `src/pages/analytics.tsx` | [ ] |
| Date range picker | `src/components/date-range-picker.tsx` | [ ] |
| Period comparison | `src/components/period-compare.tsx` | [ ] |

### Charts

| Task | File | Status |
|------|------|--------|
| Orders chart (daily/weekly) | `src/components/charts/orders-chart.tsx` | [ ] |
| Revenue chart | `src/components/charts/revenue-chart.tsx` | [ ] |
| Top products chart | `src/components/charts/top-products.tsx` | [ ] |
| Order status breakdown | `src/components/charts/status-pie.tsx` | [ ] |

### Reports

| Task | File | Status |
|------|------|--------|
| Summary stats | `src/components/summary-stats.tsx` | [ ] |
| Export to CSV | `src/utils/export-csv.ts` | [ ] |
| Print report | `src/utils/print-report.ts` | [ ] |

### Business Settings

| Task | File | Status |
|------|------|--------|
| Settings page | `src/pages/settings.tsx` | [ ] |
| Business profile edit | `src/components/business-profile.tsx` | [ ] |
| Working hours | `src/components/working-hours.tsx` | [ ] |
| Delivery settings | `src/components/delivery-settings.tsx` | [ ] |

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
- [ ] `pnpm format` - no changes
- [ ] `pnpm build` - compiles
- [ ] `pnpm lint` - 0 errors, 0 warnings
- [ ] `pnpm test` - all pass, coverage >= 70%
- [ ] Responsive design tested
- [ ] Auth flow tested
