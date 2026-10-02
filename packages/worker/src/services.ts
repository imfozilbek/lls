import {
    AdvanceOrderUseCase,
    AssignCourierUseCase,
    CancelOrderUseCase,
    CreateCourierInviteUseCase,
    CreateProductUseCase,
    DeactivateCourierUseCase,
    DeleteProductUseCase,
    GetOrderUseCase,
    GetShopBySlugUseCase,
    ConfirmPaymentUseCase,
    ExportOrdersUseCase,
    GetCourierHomeUseCase,
    GetMoneyReportUseCase,
    MarkRefundedUseCase,
    RecordCashHandoverUseCase,
    JoinAsCourierUseCase,
    ReviewCourierUseCase,
    SetCourierScheduleUseCase,
    SetShiftUseCase,
    UpdateCourierProfileUseCase,
    CourierAdvanceOrderUseCase,
    ListCouriersUseCase,
    ListMyOrdersUseCase,
    ListMyShopsUseCase,
    ListProductsUseCase,
    ListShopOrdersUseCase,
    ListShowcaseShopsUseCase,
    PlaceOrderUseCase,
    RegisterShopUseCase,
    ResolveCustomerUseCase,
    SaveContactUseCase,
    ReviewShopUseCase,
    SearchShowcaseUseCase,
    SetMarketplaceTermsUseCase,
    UpdateCustomerUseCase,
    UpdateProductUseCase,
    UpdateShopUseCase,
} from "@lls/core"

import { platformAdminIds } from "./env.js"
import { D1BusinessRepository } from "./repositories/business.repository.js"
import { D1CashHandoverRepository } from "./repositories/cash-handover.repository.js"
import { D1CourierRepository } from "./repositories/courier.repository.js"
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
    saveContact: SaveContactUseCase
    placeOrder: PlaceOrderUseCase
    getOrder: GetOrderUseCase
    cancelOrder: CancelOrderUseCase
    advanceOrder: AdvanceOrderUseCase
    listMyOrders: ListMyOrdersUseCase
    listShopOrders: ListShopOrdersUseCase
    moneyReport: GetMoneyReportUseCase
    confirmPayment: ConfirmPaymentUseCase
    markRefunded: MarkRefundedUseCase
    recordHandover: RecordCashHandoverUseCase
    exportOrders: ExportOrdersUseCase
    createCourierInvite: CreateCourierInviteUseCase
    joinAsCourier: JoinAsCourierUseCase
    listCouriers: ListCouriersUseCase
    deactivateCourier: DeactivateCourierUseCase
    assignCourier: AssignCourierUseCase
    reviewCourier: ReviewCourierUseCase
    setCourierSchedule: SetCourierScheduleUseCase
    setShift: SetShiftUseCase
    updateCourierProfile: UpdateCourierProfileUseCase
    courierHome: GetCourierHomeUseCase
    courierAdvanceOrder: CourierAdvanceOrderUseCase
    listShowcaseShops: ListShowcaseShopsUseCase
    searchShowcase: SearchShowcaseUseCase
    setMarketplaceTerms: SetMarketplaceTermsUseCase
}

export interface Services extends ServiceDeps {
    env: Bindings
    businesses: D1BusinessRepository
    products: D1ProductRepository
    customers: D1CustomerRepository
    orders: D1OrderRepository
    couriers: D1CourierRepository
    useCases: UseCases
}

/** Per-request wiring of repositories and use cases. Construction is cheap. */
export function createServices(env: Bindings, deps: ServiceDeps): Services {
    const businesses = new D1BusinessRepository(env.DB, env.TOKEN_ENC_KEY)
    const products = new D1ProductRepository(env.DB)
    const customers = new D1CustomerRepository(env.DB)
    const orders = new D1OrderRepository(env.DB)
    const couriers = new D1CourierRepository(env.DB)
    const { clock, telegram } = deps
    const orderAccess = { businesses, customers, couriers, orders }
    const courierAccess = { businesses, couriers, orders, clock }
    const money = { ...courierAccess, handovers: new D1CashHandoverRepository(env.DB) }

    return {
        env,
        clock,
        telegram,
        businesses,
        products,
        customers,
        orders,
        couriers,
        useCases: {
            registerShop: new RegisterShopUseCase(businesses, clock),
            reviewShop: new ReviewShopUseCase(businesses, platformAdminIds(env), clock),
            getShopBySlug: new GetShopBySlugUseCase(businesses, clock),
            listMyShops: new ListMyShopsUseCase(businesses, clock),
            updateShop: new UpdateShopUseCase(businesses, clock),
            createProduct: new CreateProductUseCase(businesses, products),
            updateProduct: new UpdateProductUseCase(businesses, products, clock),
            deleteProduct: new DeleteProductUseCase(businesses, products),
            listProducts: new ListProductsUseCase(businesses, products, clock),
            resolveCustomer: new ResolveCustomerUseCase(customers),
            updateCustomer: new UpdateCustomerUseCase(customers),
            saveContact: new SaveContactUseCase(customers),
            placeOrder: new PlaceOrderUseCase({ businesses, products, customers, orders, clock }),
            getOrder: new GetOrderUseCase(orderAccess),
            cancelOrder: new CancelOrderUseCase(orderAccess),
            advanceOrder: new AdvanceOrderUseCase(orderAccess),
            listMyOrders: new ListMyOrdersUseCase(customers, orders),
            listShopOrders: new ListShopOrdersUseCase(businesses, orders),
            moneyReport: new GetMoneyReportUseCase(money),
            confirmPayment: new ConfirmPaymentUseCase(money),
            markRefunded: new MarkRefundedUseCase(money),
            recordHandover: new RecordCashHandoverUseCase(money),
            exportOrders: new ExportOrdersUseCase(money),
            createCourierInvite: new CreateCourierInviteUseCase(courierAccess),
            joinAsCourier: new JoinAsCourierUseCase(courierAccess),
            listCouriers: new ListCouriersUseCase(courierAccess),
            deactivateCourier: new DeactivateCourierUseCase(courierAccess),
            assignCourier: new AssignCourierUseCase(courierAccess),
            reviewCourier: new ReviewCourierUseCase(courierAccess),
            setCourierSchedule: new SetCourierScheduleUseCase(courierAccess),
            setShift: new SetShiftUseCase(courierAccess),
            updateCourierProfile: new UpdateCourierProfileUseCase(courierAccess),
            courierHome: new GetCourierHomeUseCase(money),
            courierAdvanceOrder: new CourierAdvanceOrderUseCase(orderAccess),
            listShowcaseShops: new ListShowcaseShopsUseCase(businesses, clock),
            searchShowcase: new SearchShowcaseUseCase(businesses, products, clock),
            setMarketplaceTerms: new SetMarketplaceTermsUseCase(
                businesses,
                platformAdminIds(env),
                clock,
            ),
        },
    }
}
