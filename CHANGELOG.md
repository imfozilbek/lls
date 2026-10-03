# Changelog

All notable changes to LLS (LocalLoopSolutions) will be documented in this file.

## [Unreleased] — new stack (Cloudflare) and white-label stage 1

The platform was rebuilt. The old NestJS + MongoDB API, the old bot and admin panel, and the VPS
deploy were removed; they stay available at git tag `legacy-v0`. Versions are bumped at release.

### Many cards, Uzbek only, light only (owner's decisions)
- **Added (core):** `PayoutCardBook`: a shop keeps up to 20 cards, chooses the payment card
  customers are shown, switches it any time; the payment card is never removed (`CARD_EXISTS`,
  `PAYOUT_CARD_LIMIT`, `PAYMENT_CARD_IN_USE`). Every order keeps the card it was shown
  (`Payment.card`). Registration adds the first card.
- **Added (worker):** migration `0005_payout_cards.sql` (additive, moves today's card into the
  list); `GET/POST /api/owner/shop/cards`, `PUT …/:id/payment`, `DELETE …/:id`; the message to
  the customer names the card of the order. `PATCH /api/owner/shop` no longer takes a card.
- **Added (app):** «Kartalar» in settings: the list, «To'lov uchun», «Shu kartaga to'lansin»,
  add, delete; the order screen shows the order's card.
- **Changed:** Uzbek (Latin) only in the app, the bots, the CSV and the QR poster; the language
  switch hides itself while there is one language; old `ru` rows and Russian Telegram read as
  Uzbek. The owner guide and the courier memo are Uzbek only.
- **Changed (app):** always light: our own light palette instead of Telegram's theme; Telegram's
  header, background and bottom bar are painted white.
- **Changed (e2e):** Uzbek texts everywhere; many cards; a dark Telegram still shows the light
  app; light screenshots only.

### Transfer only, before cooking (owner's decision)
- **Changed (core):** customers pay only by transfer to the shop's card: every order starts
  unpaid; «Я перевёл» marks it sent; the owner's «Деньги пришли — принять» confirms the money and
  accepts in one step; `pending → accepted` is refused while unpaid (`PAYMENT_REQUIRED`). A shop
  without a card takes no orders (`NO_PAYOUT_CARD`) and is not open; the card is required when a
  shop registers. The money report: placed, delivered, cancelled, goods, delivery, deposits,
  paid by transfer, commission; transfers to check (cancelled ones too) and refunds.
- **Removed (core, worker, app):** cash at the door, «how the customer paid», courier cash on
  hand, handovers to the owner, debts (`PaidWith`, `CashHandover`, `RecordCashHandover`,
  `/owner/couriers/:id/handovers`). The `cash_handovers` table and the `cash_courier_id` column
  stay as history (additive schema).
- **Added (worker):** `POST /api/orders/:id/transfer-sent` (the customer only; the owner is
  pinged once); `PATCH /api/owner/orders/:id/payment` `{ action: "paid" }` accepts as well and
  hands the order to the district network if no own courier is free; the owner's card «💳 Ждём
  перевод» with «💳 Деньги пришли — принять» (`p:<id>`); the customer gets the card and the sum
  after placing; the courier card says «Оплачено заранее — денег с клиента не брать» and has one
  «Доставил»; the CSV has no payment method column.
- **Added (app):** «Оплата переводом» at checkout (the card, copy, the sum); «Я перевёл» and
  «Магазин проверяет перевод» on the order; «Скоро начнёт принимать заказы» for a shop without a
  card; owners: «Деньги пришли — принять» on the order, a banner without a card, the card field
  in onboarding (required) and in settings (never removed from there); «Деньги» without couriers'
  cash and debts; couriers: one «Доставил», no «На руках».
- **Changed (e2e):** the money spec follows the transfer path; a shop without a card; every
  accept is «Деньги пришли — принять»; the demo grocery shop has a card.

### District network (goal 06)
- **Added (core):** `District` (center + radius, waiting time); a shop's district from its
  location; network delivery per shop, on by default; the courier's own network consent; a link
  status `network`; network orders: requested after «Принять» when no own courier is free (or by
  hand), «Беру» — the first wins, one network order at a time, cash goes back to the shop;
  "nobody took it" after 10 minutes; the network's share for the admin. The delivery fee of a
  network order is a snapshot (`deliveryFeeTo`), temporarily the shop's.
- **Added (worker):** migration `0004_district_network.sql` (additive); «Новый заказ рядом»
  with «Беру» in the courier bot, «Уже взяли» for the others, the network offer after the first
  approval; `/district` and `/network` in the LLS bot; `PUT /api/owner/orders/:id/network`,
  `PUT /api/courier/network`, `GET /api/courier/network/orders`, `POST …/:id/claim`
- **Added (app):** «Беру заказы района» and «Заказы рядом» for couriers; «Сеть района» switch,
  «Доставщик сети района» and the order's network status for owners
- **Added (e2e):** the network spec: two couriers race, cash back to the shop, the switch,
  leaving the network, the 10-minute alert; demo district and two network couriers in the seed

### LLS courier bot (goal 05)
- **Added (core):** `CourierProfile` — one per person (name, phone, vehicle, shift until
  midnight); a `Courier` is now the person's link to one shop with status pending / active /
  removed, working days and "not today"; an order goes only to a courier who is approved, works
  today and is on shift (`COURIER_NOT_AVAILABLE` with the reason); the courier's home across
  shops with cash per shop
- **Added (worker):** migration `0003_courier_profiles.sql` (additive, moves today's couriers);
  the LLS courier bot (`/tg/courier`, `COURIER_BOT_TOKEN`): invites, phone, order cards with the
  shop's name and their buttons; owner approval from the shop bot or the app; `X-Bot: courier`
  auth; `/api/courier/home`, `/shift`, `/profile`; owner `PATCH /couriers/:id` and
  `POST /couriers/:id/review`; the deploy connects the courier bot
- **Changed:** courier invites, cards and "Мои доставки" moved from shop bots to the courier bot;
  `/api/courier/orders` and `/api/courier/cash` replaced by `/api/courier/home`
- **Added (app):** the courier screen across shops (shift, orders with the shop's name, cash per
  shop, vehicle); owners approve couriers, set their days and "not today", see who is on shift;
  unavailable couriers are greyed out with the reason
- **Added (e2e):** courier bot scenarios: two shops, approval, days, shift, cash per shop

### Money, hours per day, QR poster
- **Added (core):** `Payment` per order — cash or a transfer to the shop's card; statuses
  unpaid / awaiting / paid / refund due / refunded; the courier says how the customer paid at the
  door (cash, transfer, later = debt); cash a courier holds and handovers to the owner; money
  report by period; `PayoutCard` (16 digits, Luhn). No payment gateways.
- **Added (worker):** migration `0002_money.sql` (additive); `/api/owner/money`, payment
  confirm / refund, courier handovers, `/api/courier/cash`; the CSV report and the QR poster
  are sent to the owner's chat (`sendDocument`); three "Доставил" buttons in the courier's card
- **Added (app):** payment choice at checkout with the shop's card and a copy button; payment
  line on order screens; «Деньги» tab instead of «Статистика»; courier "how paid" and
  «На руках»; payout card, working hours per day and the QR poster in settings
- **Removed:** the stats endpoint and DTO (replaced by the money report)
- **Added (e2e):** 8 money scenarios; the fake Telegram accepts files

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

### Security (public repository)
- **Fixed:** the deploy workflow ran on `workflow_run` for any CI run from a branch named `main`,
  including fork pull requests, and deployed that code with the production secrets. Deploy is
  now a job in CI that runs only for a push to `main` of this repository, after green checks
- **Added:** actions pinned to commits, read-only token, secrets only in the deploy step,
  `production` environment, `scripts/check-secrets.sh` in CI and as a git pre-commit hook,
  Dependabot, `SECURITY.md`, `CODEOWNERS`
- **Changed:** the workers.dev subdomain is random instead of derived from the account id

### Local stand and end-to-end checks
- **Added (e2e):** `bun run stand` — local D1 with three demo shops, `wrangler dev`, the Mini App and
  a fake Telegram Bot API; `bun run e2e` — 67 Playwright scenarios for every role (customer,
  showcase customer, owner, courier, new owner, admin, attacker) and every main screen at 360 px in
  light and dark themes. Runs in CI as the `e2e` job; the deploy waits for it
- **Added (worker):** `TELEGRAM_API_BASE` for the local stand only; any address except
  `http://localhost` / `127.0.0.1` is ignored
- **Fixed (app):** bottom sheets (stop-list, courier, cancel reason) opened inside the list row
  under the tabs, so an option could not be tapped; they now open over the screen
- **Fixed (core, worker):** the first visit of a new customer could fail with "something went
  wrong": parallel first requests both tried to create the customer
- **Fixed (worker):** after a quick reassignment the previous courier was not told; a courier who
  joined by invite got order cards in Uzbek whatever their Telegram language
- **Fixed (worker):** the admin's application card showed the raw shop type and the owner's id
  instead of the name; the new owner was answered in Uzbek whatever their Telegram language
- **Fixed (app):** a wrong or not yet approved shop link says "shop not found" instead of
  "not found, refresh the list" with a useless retry
- **Fixed (seed):** `seed:dev` failed on the new tables (`customer_phone_shares`, `alert_log`)

### Pre-launch audit
- **Security (core, worker):** a shop bot's owner holds its token and could sign any Telegram id.
  An identity signed by a shop bot now counts only inside that shop: it never renames the global
  customer, and a customer's phone reaches a shop only after the customer sent it to that shop's
  bot (or ordered from it through the showcase). New table `customer_phone_shares`
- **Security (worker):** a pending shop opens only for its owner; a disabled shop for nobody
- **Security (worker):** rate limits on showcase search (30/min) and shop sign-up (5/min); search
  pages capped at 50 and counted in one scan
- **Security (worker):** photo uploads are capped while reading (1.5 MB), must really be JPEG, PNG
  or WebP, and are served with `X-Content-Type-Options: nosniff`
- **Added (worker):** if a shop bot fails to connect on approval, the admin is told why;
  `/reconnect <slug>` in the LLS bot retries
- **Added (worker):** alerts to platform admins through the LLS bot on server errors and failed
  notifications, one per kind per 10 minutes, bot tokens masked
- **Fixed (deploy):** the deploy never makes a new `TOKEN_ENC_KEY` while shops exist; an optional
  saved key (GitHub secret) restores it. The bot is connected only after the Worker answers
  (up to 5 minutes for a new workers.dev address)
- **Docs:** encryption key, backups and restore (`SECURITY.md`); frozen migrations after the first
  production deploy (`CLAUDE.md`); launch checklist fixes

### LLS showcase
- **Added (core):** `searchText` — one spelling for Latin/Cyrillic Uzbek and Russian; showcase search
  across shops with a marketplace deal; `SetMarketplaceTerms` for platform admins
- **Added (worker):** `X-Via: marketplace` — a shop opened from the showcase is verified with the LLS
  bot token and its orders get the `marketplace` channel and commission; `/api/showcase/shops`,
  `/api/showcase/products`; the LLS bot saves contacts, answers `/market <slug> <percent|off>`,
  writes showcase customers about status changes; the owner card shows the commission
- **Added (app):** showcase screen in the LLS bot (search, categories, shops); a tap opens the shop's
  storefront there; owners see an "LLS" mark on showcase orders and the deal in settings
- **Changed:** the LLS bot's menu button opens the showcase; onboarding stays a `/start` button

### Three verticals, own couriers, marketplace-ready data
- **Security (core, worker):** an order is found only inside the shop from `X-Shop`; before, a
  customer or an owner of two shops could reach an order through the wrong bot
- **Added (core):** `Courier` and one-time `CourierInvite` (48 h, only a hash is stored);
  `canActorMove` next to the one status table: owner — every step, courier — only
  `ready → picked_up → delivered` of their own order, customer — cancel while `pending`
- **Added (core):** order `channel` (`shop_bot` / `marketplace`) with a commission snapshot on the
  goods subtotal; always 0 for the shop's own bot. `Business.marketplace` holds the future deal
- **Added (core):** weight items (quantity in grams, selling step), returnable bottles with a
  deposit, stop-list until the next Tashkent midnight, feature defaults per business type
- **Added (worker):** routes for couriers and invites, `/start c_<code>` in the shop bot, courier
  order card with "Picked up / Delivered", ping when the order is ready; bot words by shop type;
  admin card in uz/ru; Yandex Maps links
- **Added (app):** courier screen (`?mode=courier`), couriers in settings (invite, share, remove),
  assign courier and cancel reason on owner orders, stop-list sheet, weight step and returnable
  switch in the product editor, feature switches, bottle deposit, delivery radius
- **Added (app):** "order again" in order history, bottles field in checkout, shop facts
  (delivery price, minimum, today's hours) in the header; menu vs catalog words by shop type
- **Removed:** `tailwind-merge`, unused core docs, dead value-object methods and dictionary keys
- **Changed:** `bun run seed:dev` seeds three demo shops (food, water, grocery) and a courier

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
