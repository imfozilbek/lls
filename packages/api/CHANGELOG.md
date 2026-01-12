# Changelog

All notable changes to @lls/api will be documented in this file.

## [0.2.0] - 2026-01-13

### Added
- Analytics module with controller, service
- MongoDB analytics repository with aggregation pipelines
- API endpoints: GET /analytics/business/:id, /sales, /top-products
- Period filtering (day, week, month) for analytics

## [0.1.1] - 2026-01-12

### Added
- Controller unit tests for BusinessController, ProductController, OrderController, CustomerController, CourierController
- Added @nestjs/testing dev dependency

## [0.1.0] - 2026-01-12

### Added
- NestJS application with Fastify adapter
- MongoDB integration with Mongoose schemas
- Redis caching module
- Feature modules: business, product, order, courier, customer
- Repository implementations for all entities
- Guards for Telegram authentication
- Exception filters for domain errors
- Logging and transform interceptors
