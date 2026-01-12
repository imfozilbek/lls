import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"

import { FullScreenLoading } from "./components/ui/Loading.js"
import { Login, Dashboard, Orders, Products, Settings } from "./pages/index.js"
import { useAuthStore } from "./stores/auth.store.js"

import type { ReactNode } from "react"

function ProtectedRoute({ children }: { children: ReactNode }): ReactNode {
    const business = useAuthStore((state) => state.business)
    const isLoading = useAuthStore((state) => state.isLoading)

    if (isLoading) {
        return <FullScreenLoading text="Загрузка..." />
    }

    if (!business) {
        return <Navigate to="/login" replace />
    }

    return children
}

function PublicRoute({ children }: { children: ReactNode }): ReactNode {
    const business = useAuthStore((state) => state.business)

    if (business) {
        return <Navigate to="/" replace />
    }

    return children
}

export function App(): ReactNode {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public routes */}
                <Route
                    path="/login"
                    element={
                        <PublicRoute>
                            <Login />
                        </PublicRoute>
                    }
                />

                {/* Protected routes */}
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/orders"
                    element={
                        <ProtectedRoute>
                            <Orders />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/products"
                    element={
                        <ProtectedRoute>
                            <Products />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/settings"
                    element={
                        <ProtectedRoute>
                            <Settings />
                        </ProtectedRoute>
                    }
                />

                {/* Catch all - redirect to home */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    )
}
