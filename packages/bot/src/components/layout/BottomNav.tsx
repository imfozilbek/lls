import { type ReactNode } from "react"
import { NavLink } from "react-router-dom"

import { useCart } from "../../hooks/useCart.js"
import { cn } from "../../lib/utils.js"

interface NavItem {
    path: string
    label: string
    icon: ReactNode
    badge?: number
}

export function BottomNav(): ReactNode {
    const { itemCount } = useCart()

    const items: NavItem[] = [
        {
            path: "/",
            label: "Главная",
            icon: (
                <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                </svg>
            ),
        },
        {
            path: "/cart",
            label: "Корзина",
            icon: (
                <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                </svg>
            ),
            badge: itemCount > 0 ? itemCount : undefined,
        },
        {
            path: "/orders",
            label: "Заказы",
            icon: (
                <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                    />
                </svg>
            ),
        },
    ]

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-telegram-bg border-t border-telegram-secondary safe-area-pb">
            <div className="flex items-center justify-around h-16">
                {items.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }): string =>
                            cn(
                                "flex flex-col items-center gap-1 px-4 py-2 relative",
                                "transition-colors duration-200",
                                isActive
                                    ? "text-telegram-button"
                                    : "text-telegram-hint hover:text-telegram-text",
                            )
                        }
                    >
                        <div className="relative">
                            {item.icon}
                            {item.badge && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-xs font-medium rounded-full px-1">
                                    {item.badge > 99 ? "99+" : item.badge}
                                </span>
                            )}
                        </div>
                        <span className="text-xs">{item.label}</span>
                    </NavLink>
                ))}
            </div>
        </nav>
    )
}
