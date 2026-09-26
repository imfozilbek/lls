import {
    AdvanceOrderUseCase,
    CancelOrderUseCase,
    CreateProductUseCase,
    DeleteProductUseCase,
    GetOrderUseCase,
    GetShopBySlugUseCase,
    GetShopStatsUseCase,
    ListMyOrdersUseCase,
    ListMyShopsUseCase,
    ListProductsUseCase,
    ListShopOrdersUseCase,
    PlaceOrderUseCase,
    RegisterShopUseCase,
    ResolveCustomerUseCase,
    ReviewShopUseCase,
    UpdateCustomerUseCase,
    UpdateProductUseCase,
    UpdateShopUseCase,
} from "@lls/core"

import { platformAdminIds } from "./env.js"
import { D1BusinessRepository } from "./repositories/business.repository.js"
import { D1CustomerRepository } from "./repositories/customer.repository.js"
import { D1OrderRepository } from "./repositories/order.repository.js"
import { D1ProductRepository } from "./repositories/product.repository.js"

import type { Bindings } from "./env.js"
import type { TelegramGateway } from "./telegram/gateway.js"
import type { Clock } from "@lls/core"

export interface ServiceDeps {
    telegram: TelegramGateway
    clock: Clock
}

export interface UseCases {
    registerShop: RegisterShopUseCase
    reviewShop: ReviewShopUseCase
    getShopBySlug: GetShopBySlugUseCase
    listMyShops: ListMyShopsUseCase
    updateShop: UpdateShopUseCase
    createProduct: CreateProductUseCase
    updateProduct: UpdateProductUseCase
    deleteProduct: DeleteProductUseCase
    listProducts: ListProductsUseCase
    resolveCustomer: ResolveCustomerUseCase
    updateCustomer: UpdateCustomerUseCase
    placeOrder: PlaceOrderUseCase
    getOrder: GetOrderUseCase
    cancelOrder: CancelOrderUseCase
    advanceOrder: AdvanceOrderUseCase
    listMyOrders: ListMyOrdersUseCase
    listShopOrders: ListShopOrdersUseCase
    shopStats: GetShopStatsUseCase
}

export interface Services extends ServiceDeps {
    env: Bindings
    businesses: D1BusinessRepository
    products: D1ProductRepository
    customers: D1CustomerRepository
    orders: D1OrderRepository
    useCases: UseCases
}

/** Per-request wiring of repositories and use cases. Construction is cheap. */
export function createServices(env: Bindings, deps: ServiceDeps): Services {
    const businesses = new D1BusinessRepository(env.DB, env.TOKEN_ENC_KEY)
    const products = new D1ProductRepository(env.DB)
    const customers = new D1CustomerRepository(env.DB)
    const orders = new D1OrderRepository(env.DB)
    const { clock, telegram } = deps
    const orderAccess = { businesses, customers, orders }

    return {
        env,
        clock,
        telegram,
        businesses,
        products,
        customers,
        orders,
        useCases: {
            registerShop: new RegisterShopUseCase(businesses, clock),
            reviewShop: new ReviewShopUseCase(businesses, platformAdminIds(env), clock),
            getShopBySlug: new GetShopBySlugUseCase(businesses, clock),
            listMyShops: new ListMyShopsUseCase(businesses, clock),
            updateShop: new UpdateShopUseCase(businesses, clock),
            createProduct: new CreateProductUseCase(businesses, products),
            updateProduct: new UpdateProductUseCase(businesses, products),
            deleteProduct: new DeleteProductUseCase(businesses, products),
            listProducts: new ListProductsUseCase(businesses, products),
            resolveCustomer: new ResolveCustomerUseCase(customers),
            updateCustomer: new UpdateCustomerUseCase(customers),
            placeOrder: new PlaceOrderUseCase({ businesses, products, customers, orders, clock }),
            getOrder: new GetOrderUseCase(orderAccess),
            cancelOrder: new CancelOrderUseCase(orderAccess),
            advanceOrder: new AdvanceOrderUseCase(businesses, orders),
            listMyOrders: new ListMyOrdersUseCase(customers, orders),
            listShopOrders: new ListShopOrdersUseCase(businesses, orders),
            shopStats: new GetShopStatsUseCase(businesses, orders, clock),
        },
    }
}
