import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom"

import {
    ConnectionStatus,
    NetworkErrorScreen,
    NotFoundScreen,
    ToastContainer,
} from "./components/ui/index.js"
import { useNetworkStatus } from "./hooks/useNetworkStatus.js"
import { ActiveDelivery } from "./screens/courier/ActiveDelivery.js"
import { AvailableOrders } from "./screens/courier/AvailableOrders.js"
import { DeliveryHistory } from "./screens/courier/DeliveryHistory.js"
import { Business } from "./screens/customer/Business.js"
import { Cart } from "./screens/customer/Cart.js"
import { Checkout } from "./screens/customer/Checkout.js"
import { Home } from "./screens/customer/Home.js"
import { OrderTracking } from "./screens/customer/OrderTracking.js"
import { Orders } from "./screens/customer/Orders.js"

import type { ReactNode } from "react"

function NotFoundPage(): ReactNode {
    const navigate = useNavigate()
    return <NotFoundScreen onBack={() => navigate("/")} />
}

function AppContent(): ReactNode {
    const { isOffline } = useNetworkStatus()

    if (isOffline) {
        return <NetworkErrorScreen />
    }

    return (
        <Routes>
            {/* Customer Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/business/:id" element={<Business />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order/:id" element={<OrderTracking />} />
            <Route path="/orders" element={<Orders />} />

            {/* Courier Routes */}
            <Route path="/courier" element={<AvailableOrders />} />
            <Route path="/courier/delivery/:id" element={<ActiveDelivery />} />
            <Route path="/courier/history" element={<DeliveryHistory />} />

            {/* 404 catch-all */}
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    )
}

export function App(): ReactNode {
    return (
        <BrowserRouter>
            <ConnectionStatus />
            <ToastContainer />
            <AppContent />
        </BrowserRouter>
    )
}
