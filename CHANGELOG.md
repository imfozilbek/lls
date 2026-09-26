# Changelog

All notable changes to LLS (LocalLoopSolutions) will be documented in this file.

## [Unreleased] — new stack (Cloudflare) and white-label stage 1

The platform was rebuilt. The old NestJS + MongoDB API, the old bot and admin panel, and the VPS
deploy were removed; they stay available at git tag `legacy-v0`. Versions are bumped at release.

### Stack
- **Removed:** `@lls/api` (NestJS, MongoDB, Redis), `@lls/bot`, `@lls/admin`, `deploy/`, `.gitea/`
- **Added:** `@lls/worker` — Cloudflare Worker (Hono + zod), D1 database, R2 for photos
- **Added:** `@lls/app` — one Telegram Mini App (React + Vite + Tailwind) for customers,
  owners ("Мой магазин") and shop onboarding
- **Changed:** Bun 1.3, Vitest 4.1, GitHub Actions CI and an idempotent Cloudflare deploy

### @lls/core
- **Changed:** domain rebuilt for white-label shops: one bot and brand per shop, integer UZS money,
  working hours in UTC+5 (night shifts supported), shared category taxonomy and units
- **Changed:** one status table; the owner moves `pending → … → delivered`, the customer can
  cancel only while `pending`
- **Added:** use cases for shop onboarding and admin review, catalog, orders, stats
- **Security:** prices, totals and the customer are always taken from the server, never the client
- **Removed:** couriers, domain events, analytics charts (stage 3 / unused)

### @lls/worker
- **Added:** Telegram initData check with the token of the bot that opened the app
- **Added:** AES-GCM encryption of shop bot tokens
- **Added:** shop bot webhook (`/start`, contact, owner status buttons) and platform bot webhook
  (onboarding, approve/reject, automatic webhook and menu button for approved shops)
- **Added:** notifications: new order → owner card with buttons, status change → customer
- **Fixed:** Telegram messages were never sent on workerd ("Illegal invocation" on unbound `fetch`)
- **Fixed:** a failed reply to Telegram no longer returns 500, so Telegram does not resend updates
- **Added:** `bun run seed:dev` and `bun run init-data:dev` for local end-to-end runs

### @lls/app
- **Added:** storefront with a two-column menu, categories, Uzbek and Russian texts
- **Added:** per-shop cart, checkout with Telegram contact, location and landmark, cash on delivery
- **Added:** order tracking (20 s refresh) and order history with "show more"
- **Added:** owner section: orders with status buttons, menu with photo upload (resized to WebP),
  stats for today and 7 days, shop settings (name, logo, color, delivery, hours, location)
- **Added:** three-step onboarding wizard in the platform bot
- **Added:** light and dark Telegram themes, pressed and focus states, empty states; 96 KB gzip

## [0.4.0] - 2026-01-24

### Production Readiness Release

This release completes Phase 6 (Production Readiness) with security hardening, error handling, and deployment configurations.

### @lls/core v0.4.0
- **Improved:** Order status rules with better `calculateProgress()` implementation
- **Improved:** Test coverage for order status transitions

### @lls/api v0.6.0
- **Security:** CORS restricted to specific origins (no wildcard)
- **Security:** WebSocket CORS configured with specific origin
- **Security:** Helmet security headers registered globally
- **Security:** Rate limiting applied globally with @nestjs/throttler
- **Security:** TelegramAuthGuard on all sensitive endpoints (courier, analytics, business)
- **Added:** Pagination on all list endpoints
- **Added:** MongoDB composite indexes for performance
- **Added:** Swagger/OpenAPI documentation at `/docs`
- **Added:** CreateBusinessDTO with class-validator validation
- **Added:** `.env.example` with all required variables
- **Improved:** NestJS Logger instead of console.error
- **Improved:** ForbiddenException in courier service for proper error handling
- **Improved:** Filter inactive businesses from public list

### @lls/bot v0.6.0
- **Added:** `.env.example` configuration template
- **Added:** Error screens (404, 500, network error)
- **Added:** Production logger service
- **Added:** Network status detection with `useNetworkStatus` hook
- **Added:** WebSocket auto-reconnection with exponential backoff
- **Added:** Connection status indicator UI component
- **Added:** `useWebSocket` hook for real-time updates
- **Improved:** Pagination handling in API client
- **Improved:** Checkout form disabled during submission

### @lls/admin v0.5.0
- **Added:** `.env.example` configuration template
- **Added:** Logout functionality in Settings page
- **Added:** Logout navigation in Header
- **Added:** Pagination component
- **Added:** Pagination UI in Orders page
- **Added:** Product image preview in ProductForm
- **Improved:** Pagination handling in API client

### Deployment
- **Added:** PM2 ecosystem configuration
- **Added:** Nginx configuration for reverse proxy
- **Added:** Deployment script and documentation

## [0.3.6] - 2026-01-23

### @lls/core v0.3.0
- **Added:** Domain events infrastructure (`src/domain/events/`)
- **Added:** `DomainEvent` base class with `eventId`, `occurredOn`, and `eventName`
- **Added:** `OrderCreatedEvent` for order creation notification
- **Added:** `OrderStatusChangedEvent` for status change tracking
- **Added:** `CourierAssignedEvent` for courier assignment notification
- **Added:** `EventDispatcher` singleton with pub/sub pattern and wildcard support
- **Added:** Order status transition rules (`src/domain/rules/order-status-rules.ts`)
- **Added:** `isValidTransition()` and `getValidTransitions()` functions
- **Added:** `calculateProgress()` for order status progress percentage
- **Added:** Business hours validation (`src/domain/rules/business-hours.ts`)
- **Added:** `isBusinessOpen()`, `getDaySchedule()`, `getNextOpenTime()` functions
- **Added:** Order calculator service (`src/domain/services/order-calculator.ts`)
- **Added:** `calculateOrderTotal()` with delivery fee threshold
- **Added:** `calculateDiscount()` and `applyDiscount()` functions
- **Added:** Unit tests for all new modules (83 new tests)
- **Improved:** Total tests now at 271 (was 188)

### @lls/api v0.4.0
- **Added:** Rate limiting with @nestjs/throttler (`src/middleware/rate-limiter.ts`)
- **Added:** `RateLimiterGuard` with IP extraction from Fastify request
- **Added:** Rate limit presets: general, auth, createOrder
- **Added:** Helmet security headers configuration (`src/middleware/helmet.ts`)
- **Added:** Input sanitization utilities (`src/middleware/sanitize.ts`)
- **Added:** `sanitizeString()`, `sanitizeObject()` functions
- **Added:** `hasSqlInjection()`, `hasNoSqlInjection()` detection
- **Added:** Session management service (`src/auth/session.ts`)
- **Added:** Redis-backed session storage with TTL
- **Added:** Role-based access control (`src/auth/rbac.ts`)
- **Added:** `Role`, `Resource`, `Action` enums
- **Added:** `RolesGuard` with permission checking
- **Dependencies:** Added @nestjs/throttler, @fastify/helmet

### @lls/bot v0.4.0 (via @lls/api)
- **Added:** Telegram notification service (`src/notifications/telegram-notification.service.ts`)
- **Added:** `sendOrderConfirmation()` - order placed notification
- **Added:** `sendStatusChangeNotification()` - order status updates
- **Added:** `sendCourierAssignedNotification()` - courier assignment
- **Added:** `sendDeliveryCompleteNotification()` - delivery complete
- **Added:** `sendNewOrderNotification()` - new order for business
- **Added:** `sendNewOrderAvailableNotification()` - new order for couriers
- **Added:** `OrderService` integration with notification service
- **Added:** `CourierService` integration with notification service
- **Added:** Russian language message templates

## [0.3.5] - 2026-01-23

### @lls/api
- **Added:** WebSocket gateway for real-time events (`packages/api/src/gateway/`)
- **Added:** `EventsGateway` with room-based event broadcasting
- **Added:** WebSocket events: `order_created`, `order_status_changed`, `order_cancelled`, `courier_assigned`, `new_order_available`
- **Added:** Socket.io integration with NestJS
- **Changed:** `OrderService` now emits WebSocket events on order creation, status updates, and cancellation
- **Changed:** `CourierService` now emits WebSocket events when courier takes or completes an order

### @lls/bot
- **Added:** WebSocket client for real-time updates (`src/lib/websocket.ts`)
- **Added:** `useOrderUpdates` hook for real-time order status tracking
- **Added:** `useNewOrders` hook for courier new order notifications
- **Added:** Real-time order updates on `OrderTracking` screen
- **Added:** Real-time new order notifications on `AvailableOrders` screen
- **Added:** Haptic feedback on new order notifications
- **Added:** Toast notifications for order status changes and courier assignments

## [0.3.4] - 2026-01-22

### @lls/bot
- **Added:** Toast notification system with success/error/warning/info variants
- **Added:** ErrorBoundary component for graceful error handling
- **Added:** SearchInput component for filtering content
- **Added:** Search functionality on Home screen (businesses)
- **Added:** Search functionality on Business screen (products)
- **Added:** Toast notifications for cart actions, order creation, courier actions
- **Improved:** User feedback for all critical actions

### @lls/admin
- **Added:** Toast notification system with title/message support
- **Added:** Toast notifications for product CRUD operations
- **Added:** Toast notifications for order status changes
- **Added:** Toast notifications for login success/error
- **Improved:** User feedback for all admin actions

## [0.3.3] - 2026-01-22

### @lls/api
- **Added:** BusinessAuthGuard for protecting business-specific endpoints
- **Added:** BusinessAuthMode decorator for specifying auth mode (business/product/order)
- **Added:** Input validation DTOs: CreateProductDto, UpdateProductDto, CreateOrderDto, UpdateOrderStatusDto, UpdateCustomerDto
- **Added:** BusinessAuthGuard unit tests (10 tests)
- **Security:** Business endpoints now protected - users can only modify their own business resources
- **Improved:** Test coverage now at 47 tests (was 37)

## [0.3.2] - 2026-01-22

### @lls/core
- **Added:** Analytics use case tests (GetBusinessAnalyticsUseCase, GetSalesChartUseCase, GetTopProductsUseCase)
- **Added:** Date range utility tests (getDateRangeForPeriod, parseDateRange)
- **Improved:** Test coverage now at 188 tests (was 166)

### @lls/api
- **Added:** Analytics controller tests (getDashboard, getSales, getTopProducts)
- **Improved:** Test coverage now at 37 tests (was 32)

## [0.3.1] - 2026-01-22

### @lls/core
- **Added:** GetCustomerByTelegramIdUseCase for authenticated customer endpoints
- **Added:** GetCourierByTelegramIdUseCase for authenticated courier endpoints
- **Added:** EntityNotFoundError.customerByTelegramId() factory method
- **Added:** EntityNotFoundError.courierByTelegramId() factory method
- **Added:** Unit tests for GetCustomerByTelegramIdUseCase
- **Added:** Unit tests for GetCourierByTelegramIdUseCase

### @lls/api
- **Added:** GET /customers/me endpoint with Telegram auth
- **Added:** PATCH /customers/me endpoint with Telegram auth
- **Added:** GET /orders/my endpoint for customer's orders with Telegram auth
- **Added:** GET /couriers/my-orders endpoint with Telegram auth
- **Fixed:** POST /orders/:orderId/take now uses Telegram auth instead of throwing error
- **Security:** TelegramAuthGuard now validates HMAC-SHA256 signature of initData

### @lls/bot
- **Changed:** orderApi now uses getMyOrders() instead of getByCustomer()
- **Changed:** customerApi now uses getMe() and updateMe() methods
- **Changed:** courierApi now uses takeOrder(orderId) without courierId parameter
- **Changed:** courierApi now uses getMyOrders() instead of getOrders()
- **Removed:** Unnecessary courierId state from courier store

### @lls/admin
- **Fixed:** productApi.create now uses correct /businesses/:businessId/products path
- **Fixed:** productApi.toggleAvailability now uses PATCH instead of POST

## [0.3.0] - 2026-01-22

### @lls/core
- **Added:** GetBusinessByTelegramIdUseCase for authenticating businesses by Telegram ID
- **Added:** EntityNotFoundError.businessByTelegramId() factory method
- **Added:** Unit tests for GetBusinessByTelegramIdUseCase

### @lls/api
- **Added:** TelegramAuthService with HMAC-SHA256 signature validation
- **Added:** POST /api/v1/businesses/auth/telegram endpoint for OAuth
- **Added:** GET /api/v1/businesses/telegram/:telegramId endpoint
- **Added:** TelegramLoginDto with class-validator decorators
- **Changed:** TELEGRAM_BOT_TOKEN is now required (was optional)
- **Added:** Unit tests for TelegramAuthService

### @lls/admin
- **Added:** TelegramLoginButton component with Telegram Login Widget
- **Changed:** Login page now uses Telegram OAuth instead of manual ID entry
- **Added:** businessApi.authenticateWithTelegram() API method
- **Changed:** Auth store uses loginWithTelegram() with signature validation

## [0.2.0] - 2026-01-22

### @lls/core
- **Added:** Analytics DTOs: BusinessStatsDTO, DailySalesDTO, SalesChartDTO, TopProductDTO, OrderStatusBreakdownDTO, AnalyticsDashboardDTO
- **Added:** Analytics repository port interface
- **Added:** Analytics use cases: GetBusinessAnalyticsUseCase, GetSalesChartUseCase, GetTopProductsUseCase
- **Added:** Date range utilities for analytics periods (day, week, month)
- **Added:** Comprehensive unit tests - 157 tests covering all domain logic

### @lls/api
- **Added:** NestJS REST API with Fastify adapter
- **Added:** MongoDB repositories for all entities
- **Added:** Redis caching module
- **Added:** Telegram authentication guard
- **Added:** Domain exception filters
- **Added:** Analytics endpoints: GET /api/v1/analytics/business/:businessId
- **Added:** Controller unit tests - 24 tests covering all endpoints

### @lls/bot
- **Added:** Telegram Mini App for customers and couriers
- **Added:** Customer screens: Home, Business, Cart, Checkout, Orders, OrderTracking
- **Added:** Courier screens: AvailableOrders, ActiveDelivery, DeliveryHistory
- **Added:** Zustand stores for state management
- **Added:** API client with TypeScript types

### @lls/admin
- **Added:** React admin panel for businesses
- **Added:** Dashboard with analytics charts
- **Added:** Products management (CRUD)
- **Added:** Orders management with status updates
- **Added:** Settings page

## [0.1.1] - 2026-01-12

### @lls/core
- **Added:** Unit tests for use cases: update-business, complete-delivery, get-available-orders, get-courier-orders, get-or-create-customer, update-customer
- **Added:** Additional tests for order use cases: cancel-order, get-business-orders, get-customer-orders, get-order, update-order-status
- **Added:** Product use case tests: create-product, list-products, update-product, delete-product, toggle-availability
- **Fixed:** Mock repository interfaces to match actual port definitions

## [0.1.0] - 2026-01-12

### Initial Release

#### @lls/core
- Domain entities: Business, Product, Customer, Courier, Order, OrderItem
- Value objects: Money, Address, Phone, TelegramId
- Enums: OrderStatus, BusinessType
- Domain errors: EntityNotFoundError, InvalidOrderTransitionError, ValidationError, BusinessRuleViolationError
- DTOs for all entities
- Repository port interfaces
- 20 use cases for business operations
- Unit tests for entities, value objects, and errors
