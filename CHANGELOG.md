# Changelog

All notable changes to LLS (LocalLoopSolutions) will be documented in this file.

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
