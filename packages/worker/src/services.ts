import {
    CreateTripUseCase,
    ListShopTripsUseCase,
    PickUpTripUseCase,
    RefreshTripRouteUseCase,
    ReorderTripUseCase,
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
    ReceiveCourierCashUseCase,
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
    ShopOrdersVersionUseCase,
    ListShowcaseShopsUseCase,
    MarkTransferSentUseCase,
    GetTransferReceiptUseCase,
    RemindTransferUseCase,
    RejectTransferUseCase,
    AddPayoutCardUseCase,
    ChoosePaymentCardUseCase,
    ListPayoutCardsUseCase,
    RemovePayoutCardUseCase,
    PlaceOrderUseCase,
    RegisterShopUseCase,
    ManagedBotChangedUseCase,
    ListMyManagedBotsUseCase,
    ResolveCustomerUseCase,
    SaveContactUseCase,
    ResubmitShopUseCase,
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
    ListPlatformShopsUseCase,
    NetworkStatsUseCase,
    OfferNetworkUseCase,
    OverdueNetworkOrdersUseCase,
    RequestNetworkCourierUseCase,
    SetDistrictUseCase,
    SetNetworkMembershipUseCase,
} from "@zumda/core"

import { platformAdminIds } from "./env.js"
import { D1BusinessRepository } from "./repositories/business.repository.js"
import { D1CourierRepository } from "./repositories/courier.repository.js"
import { D1CustomerRepository } from "./repositories/customer.repository.js"
import { D1DistrictRepository } from "./repositories/district.repository.js"
import { D1ManagedBotRepository } from "./repositories/managed-bot.repository.js"
import { D1NetworkOfferRepository } from "./repositories/network-offer.repository.js"
import { D1OrderRepository } from "./repositories/order.repository.js"
import { D1PayoutCardRepository } from "./repositories/payout-card.repository.js"
import { D1ProductRepository } from "./repositories/product.repository.js"
import { R2ReceiptStore } from "./repositories/receipt.store.js"
import { D1TripRepository } from "./repositories/trip.repository.js"
import { OrsRoutePlanner } from "./routing.js"

import type { Bindings } from "./env.js"
import type { TelegramGateway } from "./telegram/gateway.js"
import type { LoginKeys } from "./telegram-login.js"
import type { Clock, TripDeps } from "@zumda/core"

export interface ServiceDeps {
    telegram: TelegramGateway
    clock: Clock
    /** Telegram Login's public keys (tests and the stand bring their own). */
    loginKeys?: LoginKeys
}

export interface UseCases {
    registerShop: RegisterShopUseCase
    managedBotChanged: ManagedBotChangedUseCase
    listMyManagedBots: ListMyManagedBotsUseCase
    listPayoutCards: ListPayoutCardsUseCase
    addPayoutCard: AddPayoutCardUseCase
    choosePaymentCard: ChoosePaymentCardUseCase
    removePayoutCard: RemovePayoutCardUseCase
    reviewShop: ReviewShopUseCase
    resubmitShop: ResubmitShopUseCase
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
    getTransferReceipt: GetTransferReceiptUseCase
    remindTransfer: RemindTransferUseCase
    rejectTransfer: RejectTransferUseCase
    listMyOrders: ListMyOrdersUseCase
    listShopOrders: ListShopOrdersUseCase
    shopOrdersVersion: ShopOrdersVersionUseCase
    moneyReport: GetMoneyReportUseCase
    confirmPayment: ConfirmPaymentUseCase
    markRefunded: MarkRefundedUseCase
    receiveCourierCash: ReceiveCourierCashUseCase
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
    listPlatformShops: ListPlatformShopsUseCase
    freeNetworkCouriers: FreeNetworkCouriersUseCase
    createTrip: CreateTripUseCase
    reorderTrip: ReorderTripUseCase
    pickUpTrip: PickUpTripUseCase
    refreshTripRoute: RefreshTripRouteUseCase
    listShopTrips: ListShopTripsUseCase
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
    /** Bots Zumda | Business created and manages for owners. */
    managedBots: D1ManagedBotRepository
    useCases: UseCases
}

type TripUseCases = Pick<
    UseCases,
    "createTrip" | "reorderTrip" | "pickUpTrip" | "refreshTripRoute" | "listShopTrips"
>

function newTripId(): string {
    return crypto.randomUUID()
}

function tripUseCases(deps: TripDeps): TripUseCases {
    return {
        createTrip: new CreateTripUseCase(deps),
        reorderTrip: new ReorderTripUseCase(deps),
        pickUpTrip: new PickUpTripUseCase(deps),
        refreshTripRoute: new RefreshTripRouteUseCase(deps),
        listShopTrips: new ListShopTripsUseCase(deps),
    }
}

/** Per-request wiring of repositories and use cases. Construction is cheap. */
export function createServices(env: Bindings, deps: ServiceDeps): Services {
    const businesses = new D1BusinessRepository(env.DB, env.TOKEN_ENC_KEY)
    const products = new D1ProductRepository(env.DB)
    const customers = new D1CustomerRepository(env.DB)
    const orders = new D1OrderRepository(env.DB)
    const couriers = new D1CourierRepository(env.DB)
    const districts = new D1DistrictRepository(env.DB)
    const cards = new D1PayoutCardRepository(env.DB)
    const receipts = new R2ReceiptStore(env.BUCKET)
    const { clock, telegram } = deps
    const managedBots = new D1ManagedBotRepository(env.DB, env.TOKEN_ENC_KEY, clock)
    const admins = platformAdminIds(env)
    const orderAccess = { businesses, customers, couriers, orders }
    const courierAccess = { businesses, couriers, orders, clock }
    const trips = new D1TripRepository(env.DB)
    const network = { ...courierAccess, districts, trips }
    const routes = new OrsRoutePlanner(env.ORS_API_KEY, env.ORS_API_BASE)
    const tripDeps: TripDeps = { ...courierAccess, trips, routes, newId: newTripId }
    const cardBook = { businesses, cards, clock }

    return {
        env,
        clock,
        telegram,
        loginKeys: deps.loginKeys,
        businesses,
        products,
        customers,
        orders,
        couriers,
        districts,
        networkOffers: new D1NetworkOfferRepository(env.DB),
        managedBots,
        useCases: {
            registerShop: new RegisterShopUseCase(businesses, clock, cards, managedBots, districts),
            managedBotChanged: new ManagedBotChangedUseCase(businesses, managedBots, clock),
            listMyManagedBots: new ListMyManagedBotsUseCase(managedBots),
            listPayoutCards: new ListPayoutCardsUseCase(cardBook),
            addPayoutCard: new AddPayoutCardUseCase(cardBook),
            choosePaymentCard: new ChoosePaymentCardUseCase(cardBook),
            removePayoutCard: new RemovePayoutCardUseCase(cardBook),
            reviewShop: new ReviewShopUseCase(businesses, admins, clock),
            resubmitShop: new ResubmitShopUseCase(businesses, clock),
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
            markTransferSent: new MarkTransferSentUseCase({ ...orderAccess, receipts, clock }),
            getTransferReceipt: new GetTransferReceiptUseCase(orderAccess),
            remindTransfer: new RemindTransferUseCase({ ...orderAccess, receipts, clock }),
            listMyOrders: new ListMyOrdersUseCase(customers, orders),
            listShopOrders: new ListShopOrdersUseCase(businesses, orders),
            shopOrdersVersion: new ShopOrdersVersionUseCase(businesses, orders),
            moneyReport: new GetMoneyReportUseCase(network),
            confirmPayment: new ConfirmPaymentUseCase(network),
            markRefunded: new MarkRefundedUseCase(network),
            receiveCourierCash: new ReceiveCourierCashUseCase(network),
            rejectTransfer: new RejectTransferUseCase(network),
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
            listPlatformShops: new ListPlatformShopsUseCase(businesses, customers, admins, clock),
            freeNetworkCouriers: new FreeNetworkCouriersUseCase(network),
            ...tripUseCases(tripDeps),
        },
    }
}
