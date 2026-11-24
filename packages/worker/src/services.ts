import {
    CreateTripUseCase,
    ListShopTripsUseCase,
    PickUpTripUseCase,
    RefreshTripRouteUseCase,
    ReorderTripUseCase,
    AddDeliveryNoteUseCase,
    AdvanceOrderUseCase,
    AssignCourierUseCase,
    AutoAssignOnlyCourierUseCase,
    DeliverMyselfUseCase,
    SendOrderUseCase,
    CancelOrderUseCase,
    CreateCourierInviteUseCase,
    CreateProductUseCase,
    CreateProductsUseCase,
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
    ShopBotOfUseCase,
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
    MakeDemoShopUseCase,
    ResetDemoShopUseCase,
    GuideStatusUseCase,
    SendGuidesUseCase,
    PhoneAskStatusUseCase,
    AskPhonesUseCase,
    UpdateCustomerUseCase,
    UpdateProductUseCase,
    ChangeProductPhotosUseCase,
    RemoveOrderLineUseCase,
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
    ConnectShopChannelUseCase,
    ConnectSupportGroupUseCase,
    DisconnectSupportGroupUseCase,
    FindSupportCustomerUseCase,
    GetSupportGroupUseCase,
    LoseSupportGroupUseCase,
    MarkSupportAnsweredUseCase,
    SupportContextUseCase,
    SupportTopicOfCustomerUseCase,
    LoseShopChannelUseCase,
    DisconnectShopChannelUseCase,
    GetShopChannelUseCase,
    RelinkChannelPostUseCase,
    CreateAdLinkUseCase,
    ListSourceLinksUseCase,
    OpenSourceLinkUseCase,
    FindOrderSourceUseCase,
} from "@zumda/core"

import { platformAdminIds } from "./env.js"
import { D1BusinessRepository } from "./repositories/business.repository.js"
import { D1CourierRepository } from "./repositories/courier.repository.js"
import { D1CustomerRepository } from "./repositories/customer.repository.js"
import { D1DistrictRepository } from "./repositories/district.repository.js"
import { D1GuideRecipients } from "./repositories/guide.repository.js"
import { D1ManagedBotRepository } from "./repositories/managed-bot.repository.js"
import { D1NetworkOfferRepository } from "./repositories/network-offer.repository.js"
import { D1OrderRepository } from "./repositories/order.repository.js"
import { D1PayoutCardRepository } from "./repositories/payout-card.repository.js"
import { D1PhoneAskRecipients } from "./repositories/phone-ask.repository.js"
import { D1ProductRepository } from "./repositories/product.repository.js"
import { R2ReceiptStore } from "./repositories/receipt.store.js"
import {
    D1ShopChannelRepository,
    D1SourceLinkRepository,
} from "./repositories/source-link.repository.js"
import {
    D1SupportGroupRepository,
    D1SupportRefusalRepository,
    D1SupportThreadRepository,
} from "./repositories/support.repository.js"
import { D1TripRepository } from "./repositories/trip.repository.js"
import { OrsRoutePlanner } from "./routing.js"
import { WebChannelHistory, telegramWebBase } from "./telegram/channel-history.js"
import { TelegramGuideSender } from "./telegram/guides.js"
import { TelegramPhoneAskSender } from "./telegram/phone-asks.js"

import type { Bindings } from "./env.js"
import type { TelegramGateway } from "./telegram/gateway.js"
import type { LoginKeys } from "./telegram-login.js"
import type {
    ChannelHistoryReader,
    Clock,
    DeliveryDeps,
    DemoShopDeps,
    SourceLinkDeps,
    TripDeps,
} from "@zumda/core"

export interface ServiceDeps {
    telegram: TelegramGateway
    clock: Clock
    /** Telegram Login's public keys (tests and the stand bring their own). */
    loginKeys?: LoginKeys
    /** Public channels' past (tests bring their own pages). */
    history?: ChannelHistoryReader
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
    createProducts: CreateProductsUseCase
    updateProduct: UpdateProductUseCase
    changeProductPhotos: ChangeProductPhotosUseCase
    removeOrderLine: RemoveOrderLineUseCase
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
    deliverMyself: DeliverMyselfUseCase
    autoAssignOnlyCourier: AutoAssignOnlyCourierUseCase
    sendOrder: SendOrderUseCase
    addDeliveryNote: AddDeliveryNoteUseCase
    reviewCourier: ReviewCourierUseCase
    setCourierSchedule: SetCourierScheduleUseCase
    setShift: SetShiftUseCase
    updateCourierProfile: UpdateCourierProfileUseCase
    courierHome: GetCourierHomeUseCase
    courierAdvanceOrder: CourierAdvanceOrderUseCase
    listShowcaseShops: ListShowcaseShopsUseCase
    shopBotOf: ShopBotOfUseCase
    searchShowcase: SearchShowcaseUseCase
    setMarketplaceTerms: SetMarketplaceTermsUseCase
    makeDemoShop: MakeDemoShopUseCase
    resetDemoShop: ResetDemoShopUseCase
    guideStatus: GuideStatusUseCase
    sendGuides: SendGuidesUseCase
    phoneAskStatus: PhoneAskStatusUseCase
    askPhones: AskPhonesUseCase
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
    connectShopChannel: ConnectShopChannelUseCase
    loseShopChannel: LoseShopChannelUseCase
    disconnectShopChannel: DisconnectShopChannelUseCase
    getShopChannel: GetShopChannelUseCase
    relinkChannelPost: RelinkChannelPostUseCase
    createAdLink: CreateAdLinkUseCase
    listSourceLinks: ListSourceLinksUseCase
    openSourceLink: OpenSourceLinkUseCase
    findOrderSource: FindOrderSourceUseCase
    connectSupportGroup: ConnectSupportGroupUseCase
    loseSupportGroup: LoseSupportGroupUseCase
    disconnectSupportGroup: DisconnectSupportGroupUseCase
    getSupportGroup: GetSupportGroupUseCase
    findSupportCustomer: FindSupportCustomerUseCase
    markSupportAnswered: MarkSupportAnsweredUseCase
    supportTopicOfCustomer: SupportTopicOfCustomerUseCase
    supportContext: SupportContextUseCase
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
    /** The shop's own Telegram channel, and the posts and ad links customers came from. */
    shopChannels: D1ShopChannelRepository
    sourceLinks: D1SourceLinkRepository
    history: ChannelHistoryReader
    /** The shop's support group, and each customer's topic in it (goal 21). */
    supportGroups: D1SupportGroupRepository
    supportThreads: D1SupportThreadRepository
    useCases: UseCases
}

type ChannelUseCases = Pick<
    UseCases,
    | "connectShopChannel"
    | "loseShopChannel"
    | "disconnectShopChannel"
    | "getShopChannel"
    | "relinkChannelPost"
    | "createAdLink"
    | "listSourceLinks"
    | "openSourceLink"
    | "findOrderSource"
>

/** The shop's channel and its links; posting, deleting and editing need Telegram (the Worker's). */
function channelParts(
    db: D1Database,
    businesses: D1BusinessRepository,
    products: D1ProductRepository,
): {
    shopChannels: D1ShopChannelRepository
    sourceLinks: D1SourceLinkRepository
    useCases: ChannelUseCases
} {
    const shopChannels = new D1ShopChannelRepository(db)
    const sourceLinks = new D1SourceLinkRepository(db)
    return {
        shopChannels,
        sourceLinks,
        useCases: channelUseCases({
            businesses,
            products,
            channels: shopChannels,
            links: sourceLinks,
        }),
    }
}

function channelUseCases(deps: SourceLinkDeps): ChannelUseCases {
    const { businesses, channels, links } = deps
    return {
        connectShopChannel: new ConnectShopChannelUseCase({ businesses, channels }),
        loseShopChannel: new LoseShopChannelUseCase(channels),
        disconnectShopChannel: new DisconnectShopChannelUseCase({ businesses, channels }),
        getShopChannel: new GetShopChannelUseCase({ businesses, channels }),
        relinkChannelPost: new RelinkChannelPostUseCase(deps),
        createAdLink: new CreateAdLinkUseCase(deps),
        listSourceLinks: new ListSourceLinksUseCase(deps),
        openSourceLink: new OpenSourceLinkUseCase(deps),
        findOrderSource: new FindOrderSourceUseCase(links),
    }
}

type SupportUseCases = Pick<
    UseCases,
    | "getShopBySlug"
    | "connectSupportGroup"
    | "loseSupportGroup"
    | "disconnectSupportGroup"
    | "getSupportGroup"
    | "findSupportCustomer"
    | "markSupportAnswered"
    | "supportTopicOfCustomer"
    | "supportContext"
>

/** The shop's support group and its customers' topics (goal 21). */
function supportParts(
    db: D1Database,
    deps: {
        businesses: D1BusinessRepository
        customers: D1CustomerRepository
        orders: D1OrderRepository
        products: D1ProductRepository
        sourceLinks: D1SourceLinkRepository
        clock: Clock
    },
): {
    repos: { supportGroups: D1SupportGroupRepository; supportThreads: D1SupportThreadRepository }
    useCases: SupportUseCases
} {
    const { businesses, customers, orders, products, sourceLinks, clock } = deps
    const supportGroups = new D1SupportGroupRepository(db)
    const supportThreads = new D1SupportThreadRepository(db)
    const supportRefusals = new D1SupportRefusalRepository(db)
    const groupDeps = { businesses, supportGroups, supportRefusals }
    const threadDeps = { supportGroups, supportThreads }
    return {
        repos: { supportGroups, supportThreads },
        useCases: {
            // The storefront says whether the shop answers messages (`supportChat`).
            getShopBySlug: new GetShopBySlugUseCase(businesses, clock, customers, supportGroups),
            connectSupportGroup: new ConnectSupportGroupUseCase(groupDeps),
            loseSupportGroup: new LoseSupportGroupUseCase(groupDeps),
            disconnectSupportGroup: new DisconnectSupportGroupUseCase(groupDeps),
            getSupportGroup: new GetSupportGroupUseCase(groupDeps),
            findSupportCustomer: new FindSupportCustomerUseCase(threadDeps),
            markSupportAnswered: new MarkSupportAnsweredUseCase(threadDeps),
            supportTopicOfCustomer: new SupportTopicOfCustomerUseCase(threadDeps),
            supportContext: new SupportContextUseCase({
                customers,
                orders,
                products,
                links: sourceLinks,
            }),
        },
    }
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

type CourierUseCases = Pick<
    UseCases,
    | "createCourierInvite"
    | "joinAsCourier"
    | "listCouriers"
    | "deactivateCourier"
    | "assignCourier"
    | "deliverMyself"
    | "autoAssignOnlyCourier"
    | "sendOrder"
    | "addDeliveryNote"
    | "reviewCourier"
    | "setCourierSchedule"
    | "setShift"
    | "updateCourierProfile"
    | "courierHome"
    | "courierAdvanceOrder"
>

/** The shop's couriers and dispatchers, and the courier screen. */
function courierUseCases(
    access: DeliveryDeps,
    network: ConstructorParameters<typeof GetCourierHomeUseCase>[0],
): CourierUseCases {
    return {
        createCourierInvite: new CreateCourierInviteUseCase(access),
        joinAsCourier: new JoinAsCourierUseCase(access),
        listCouriers: new ListCouriersUseCase(access),
        deactivateCourier: new DeactivateCourierUseCase(access),
        assignCourier: new AssignCourierUseCase(access),
        deliverMyself: new DeliverMyselfUseCase(access),
        autoAssignOnlyCourier: new AutoAssignOnlyCourierUseCase(access),
        sendOrder: new SendOrderUseCase(access),
        addDeliveryNote: new AddDeliveryNoteUseCase(access),
        reviewCourier: new ReviewCourierUseCase(access),
        setCourierSchedule: new SetCourierScheduleUseCase(access),
        setShift: new SetShiftUseCase(access),
        updateCourierProfile: new UpdateCourierProfileUseCase(access),
        courierHome: new GetCourierHomeUseCase(network),
        courierAdvanceOrder: new CourierAdvanceOrderUseCase(access),
    }
}

type AdminUseCases = Pick<
    UseCases,
    | "setMarketplaceTerms"
    | "makeDemoShop"
    | "resetDemoShop"
    | "guideStatus"
    | "sendGuides"
    | "phoneAskStatus"
    | "askPhones"
>

/**
 * «Platforma»: one shop's showcase deal, making it a demo or starting the demo again; and
 * «Qo'llanma», each role's guide sent once from its bot.
 */
function adminUseCases(
    base: Omit<DemoShopDeps, "platformAdminIds"> & {
        businesses: D1BusinessRepository
        env: Bindings
        telegram: TelegramGateway
    },
    platformAdminIds: readonly number[],
): AdminUseCases {
    const { businesses, clock, env, telegram } = base
    const deps = { ...base, platformAdminIds }
    const guides = {
        recipients: new D1GuideRecipients(env.DB),
        sender: new TelegramGuideSender({ env, telegram, businesses }),
        clock,
        platformAdminIds,
    }
    const phoneAsks = {
        recipients: new D1PhoneAskRecipients(env.DB),
        sender: new TelegramPhoneAskSender({ env, telegram, businesses }),
        clock,
        platformAdminIds,
    }
    return {
        setMarketplaceTerms: new SetMarketplaceTermsUseCase(businesses, platformAdminIds, clock),
        makeDemoShop: new MakeDemoShopUseCase(deps),
        resetDemoShop: new ResetDemoShopUseCase(deps),
        guideStatus: new GuideStatusUseCase(guides),
        sendGuides: new SendGuidesUseCase(guides),
        phoneAskStatus: new PhoneAskStatusUseCase(phoneAsks),
        askPhones: new AskPhonesUseCase(phoneAsks),
    }
}

/** Per-request wiring of repositories and use cases. Construction is cheap. */
/** Public channels' past, read from Telegram's own web pages. */
function webHistory(env: Bindings): ChannelHistoryReader {
    return new WebChannelHistory(undefined, telegramWebBase(env.TELEGRAM_WEB_BASE))
}

export function createServices(env: Bindings, deps: ServiceDeps): Services {
    const businesses = new D1BusinessRepository(env.DB, env.TOKEN_ENC_KEY)
    const products = new D1ProductRepository(env.DB)
    const customers = new D1CustomerRepository(env.DB)
    const orders = new D1OrderRepository(env.DB)
    const couriers = new D1CourierRepository(env.DB)
    const districts = new D1DistrictRepository(env.DB)
    const cards = new D1PayoutCardRepository(env.DB)
    const receipts = new R2ReceiptStore(env.RECEIPTS)
    const { clock, telegram } = deps
    const managedBots = new D1ManagedBotRepository(env.DB, env.TOKEN_ENC_KEY, clock)
    const admins = platformAdminIds(env)
    const orderAccess = { businesses, customers, couriers, orders }
    const courierAccess = { businesses, couriers, orders, clock }
    const trips = new D1TripRepository(env.DB)
    const network = { ...courierAccess, districts, trips, customers }
    const routes = new OrsRoutePlanner(env.ORS_API_KEY, env.ORS_API_BASE)
    const tripDeps: TripDeps = { ...courierAccess, trips, routes, newId: newTripId }
    const cardBook = { businesses, cards, clock }
    const channel = channelParts(env.DB, businesses, products)
    const supportRepos = { businesses, customers, orders, products, clock }
    const support = supportParts(env.DB, { ...supportRepos, sourceLinks: channel.sourceLinks })

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
        shopChannels: channel.shopChannels,
        sourceLinks: channel.sourceLinks,
        ...support.repos,
        history: deps.history ?? webHistory(env),
        useCases: {
            registerShop: new RegisterShopUseCase(businesses, clock, managedBots, districts),
            managedBotChanged: new ManagedBotChangedUseCase(businesses, managedBots, clock),
            listMyManagedBots: new ListMyManagedBotsUseCase(managedBots),
            listPayoutCards: new ListPayoutCardsUseCase(cardBook),
            addPayoutCard: new AddPayoutCardUseCase(cardBook),
            choosePaymentCard: new ChoosePaymentCardUseCase(cardBook),
            removePayoutCard: new RemovePayoutCardUseCase(cardBook),
            reviewShop: new ReviewShopUseCase(businesses, admins, clock),
            resubmitShop: new ResubmitShopUseCase(businesses, clock),
            ...support.useCases,
            listMyShops: new ListMyShopsUseCase(businesses, clock),
            updateShop: new UpdateShopUseCase(businesses, clock, districts),
            createProduct: new CreateProductUseCase(businesses, products),
            createProducts: new CreateProductsUseCase(businesses, products),
            updateProduct: new UpdateProductUseCase(businesses, products, clock),
            changeProductPhotos: new ChangeProductPhotosUseCase(businesses, products),
            removeOrderLine: new RemoveOrderLineUseCase({ businesses, orders, products, clock }),
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
            ...courierUseCases({ ...orderAccess, clock }, network),
            listShowcaseShops: new ListShowcaseShopsUseCase(businesses, clock),
            shopBotOf: new ShopBotOfUseCase(businesses),
            searchShowcase: new SearchShowcaseUseCase(businesses, products, clock),
            ...adminUseCases({ ...cardBook, products, couriers, orders, env, telegram }, admins),
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
            ...channel.useCases,
        },
    }
}
