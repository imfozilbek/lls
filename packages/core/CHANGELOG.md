# Changelog

All notable changes to @lls/core will be documented in this file.

## [0.2.0] - 2026-01-13

### Added
- Analytics DTOs: BusinessStatsDTO, DailySalesDTO, SalesChartDTO, TopProductDTO, OrderStatusBreakdownDTO, AnalyticsDashboardDTO
- Analytics repository port interface
- Analytics use cases: GetBusinessAnalyticsUseCase, GetSalesChartUseCase, GetTopProductsUseCase
- Date range utilities for analytics periods (day, week, month)

## [0.1.1] - 2026-01-12

### Added
- Unit tests for use cases: update-business, complete-delivery, get-available-orders, get-courier-orders, get-or-create-customer, update-customer
- Additional tests for order use cases: cancel-order, get-business-orders, get-customer-orders, get-order, update-order-status
- Product use case tests: create-product, list-products, update-product, delete-product, toggle-availability

### Fixed
- Fixed mock repository interfaces to match actual port definitions

## [0.1.0] - 2026-01-12

### Added
- Domain entities: Business, Product, Customer, Courier, Order, OrderItem
- Value objects: Money, Address, Phone, TelegramId
- Enums: OrderStatus, BusinessType
- Domain errors: EntityNotFoundError, InvalidOrderTransitionError, ValidationError, BusinessRuleViolationError
- DTOs for all entities
- Repository port interfaces
- 20 use cases for business operations
- Unit tests for entities, value objects, and errors
