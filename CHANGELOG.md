# Changelog

All notable changes to LLS (LocalLoopSolutions) will be documented in this file.

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
