import { useNavigate } from "react-router-dom"

import { getBusinessTypeLabel } from "../../lib/utils.js"
import { useAuthStore } from "../../stores/auth.store.js"

import type { ReactNode } from "react"

export function Header(): ReactNode {
    const navigate = useNavigate()
    const business = useAuthStore((state) => state.business)
    const logout = useAuthStore((state) => state.logout)

    const handleLogout = (): void => {
        logout()
        void navigate("/login", { replace: true })
    }

    return (
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
            <div>
                {business && (
                    <>
                        <h1 className="text-lg font-semibold text-gray-900">{business.name}</h1>
                        <p className="text-sm text-gray-500">
                            {getBusinessTypeLabel(business.type)}
                        </p>
                    </>
                )}
            </div>

            <div className="flex items-center gap-4">
                {/* Notifications (placeholder) */}
                <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                        />
                    </svg>
                </button>

                {/* User menu */}
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                            {business?.name.charAt(0).toUpperCase() || "?"}
                        </span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        Выйти
                    </button>
                </div>
            </div>
        </header>
    )
}
