// Common DTOs
export type { AddressDTO, MoneyDTO, PaginationInput, PaginatedResult } from "./common.dto.js"
export { createPaginatedResult } from "./common.dto.js"

// Business DTOs
export type {
    BusinessDTO,
    CreateBusinessInput,
    UpdateBusinessInput,
    BusinessFilter,
} from "./business.dto.js"
export { toBusinessDTO } from "./business.dto.js"

// Product DTOs
export type { ProductDTO, CreateProductInput, UpdateProductInput } from "./product.dto.js"
export { toProductDTO } from "./product.dto.js"

// Customer DTOs
export type {
    CustomerDTO,
    CreateCustomerInput,
    UpdateCustomerInput,
    TelegramUserData,
} from "./customer.dto.js"
export { toCustomerDTO } from "./customer.dto.js"

// Order DTOs
export type {
    OrderDTO,
    OrderItemDTO,
    CreateOrderInput,
    CreateOrderItemInput,
    UpdateOrderStatusInput,
    CancelOrderInput,
    TakeOrderInput,
    OrderFilter,
} from "./order.dto.js"
export { toOrderDTO } from "./order.dto.js"

// Analytics DTOs
export type {
    AnalyticsPeriod,
    AnalyticsInput,
    BusinessStatsDTO,
    DailySalesDTO,
    SalesChartDTO,
    TopProductDTO,
    TopProductsDTO,
    OrderStatusBreakdownDTO,
    AnalyticsDashboardDTO,
} from "./analytics.dto.js"
