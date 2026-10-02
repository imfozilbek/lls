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
    MarkTransferSentUseCase,
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
    AutoRequestNetworkUseCase,
    ClaimNetworkOrderUseCase,
    FreeNetworkCouriersUseCase,
    ListNetworkOrdersUseCase,
    NetworkStatsUseCase,
    OfferNetworkUseCase,
    OverdueNetworkOrdersUseCase,
    RequestNetworkCourierUseCase,
    SetDistrictUseCase,
    SetNetworkMembershipUseCase,
} from "@lls/core"

import { platformAdminIds } from "./env.js"
import { D1BusinessRepository } from "./repositories/business.repository.js"
import { D1CourierRepository } from "./repositories/courier.repository.js"
import { D1CustomerRepository } from "./repositories/customer.repository.js"
import { D1DistrictRepository } from "./repositories/district.repository.js"
import { D1NetworkOfferRepository } from "./repositories/network-offer.repository.js"
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
    markTransferSent: MarkTransferSentUseCase
    listMyOrders: ListMyOrdersUseCase
    listShopOrders: ListShopOrdersUseCase
    moneyReport: GetMoneyReportUseCase
    confirmPayment: ConfirmPaymentUseCase
    markRefunded: MarkRefundedUseCase
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
    setDistrict: SetDistrictUseCase
    setNetworkMembership: SetNetworkMembershipUseCase
    offerNetwork: OfferNetworkUseCase
    requestNetworkCourier: RequestNetworkCourierUseCase
    autoRequestNetwork: AutoRequestNetworkUseCase
    listNetworkOrders: ListNetworkOrdersUseCase
    claimNetworkOrder: ClaimNetworkOrderUseCase
    overdueNetworkOrders: OverdueNetworkOrdersUseCase
    networkStats: NetworkStatsUseCase
    freeNetworkCouriers: FreeNetworkCouriersUseCase
}

export interface Services extends ServiceDeps {
    env: Bindings
    businesses: D1BusinessRepository
    products: D1ProductRepository
    customers: D1CustomerRepository
    orders: D1OrderRepository
    couriers: D1CourierRepository
    districts: D1DistrictRepository
    networkOffers: D1NetworkOfferRepository
    useCases: UseCases
}

/** Per-request wiring of repositories and use cases. Construction is cheap. */
export function createServices(env: Bindings, deps: ServiceDeps): Services {
    const businesses = new D1BusinessRepository(env.DB, env.TOKEN_ENC_KEY)
    const products = new D1ProductRepository(env.DB)
    const customers = new D1CustomerRepository(env.DB)
    const orders = new D1OrderRepository(env.DB)
    const couriers = new D1CourierRepository(env.DB)
    const districts = new D1DistrictRepository(env.DB)
    const { clock, telegram } = deps
    const admins = platformAdminIds(env)
    const orderAccess = { businesses, customers, couriers, orders }
    const courierAccess = { businesses, couriers, orders, clock }
    const network = { ...courierAccess, districts }

    return {
        env,
        clock,
        telegram,
        businesses,
        products,
        customers,
        orders,
        couriers,
        districts,
        networkOffers: new D1NetworkOfferRepository(env.DB),
        useCases: {
            registerShop: new RegisterShopUseCase(businesses, clock),
            reviewShop: new ReviewShopUseCase(businesses, admins, clock),
            getShopBySlug: new GetShopBySlugUseCase(businesses, clock),
            listMyShops: new ListMyShopsUseCase(businesses, clock),
            updateShop: new UpdateShopUseCase(businesses, clock, districts),
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
            markTransferSent: new MarkTransferSentUseCase(orderAccess),
            listMyOrders: new ListMyOrdersUseCase(customers, orders),
            listShopOrders: new ListShopOrdersUseCase(businesses, orders),
            moneyReport: new GetMoneyReportUseCase(network),
            confirmPayment: new ConfirmPaymentUseCase(network),
            markRefunded: new MarkRefundedUseCase(network),
            exportOrders: new ExportOrdersUseCase(network),
            createCourierInvite: new CreateCourierInviteUseCase(courierAccess),
            joinAsCourier: new JoinAsCourierUseCase(courierAccess),
            listCouriers: new ListCouriersUseCase(courierAccess),
            deactivateCourier: new DeactivateCourierUseCase(courierAccess),
            assignCourier: new AssignCourierUseCase(courierAccess),
            reviewCourier: new ReviewCourierUseCase(courierAccess),
            setCourierSchedule: new SetCourierScheduleUseCase(courierAccess),
            setShift: new SetShiftUseCase(courierAccess),
            updateCourierProfile: new UpdateCourierProfileUseCase(courierAccess),
            courierHome: new GetCourierHomeUseCase(network),
            courierAdvanceOrder: new CourierAdvanceOrderUseCase(orderAccess),
            listShowcaseShops: new ListShowcaseShopsUseCase(businesses, clock),
            searchShowcase: new SearchShowcaseUseCase(businesses, products, clock),
            setMarketplaceTerms: new SetMarketplaceTermsUseCase(businesses, admins, clock),
            setDistrict: new SetDistrictUseCase(network, admins),
            setNetworkMembership: new SetNetworkMembershipUseCase(network),
            offerNetwork: new OfferNetworkUseCase(network),
            requestNetworkCourier: new RequestNetworkCourierUseCase(network),
            autoRequestNetwork: new AutoRequestNetworkUseCase(network),
            listNetworkOrders: new ListNetworkOrdersUseCase(network),
            claimNetworkOrder: new ClaimNetworkOrderUseCase(network),
            overdueNetworkOrders: new OverdueNetworkOrdersUseCase(network),
            networkStats: new NetworkStatsUseCase(network, admins),
            freeNetworkCouriers: new FreeNetworkCouriersUseCase(network),
        },
    }
}
