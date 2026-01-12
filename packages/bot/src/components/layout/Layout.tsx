import { type ReactNode } from "react"

import { cn } from "../../lib/utils.js"

import { BottomNav } from "./BottomNav.js"
import { Header } from "./Header.js"

interface LayoutProps {
    children: ReactNode
    title?: string
    showBack?: boolean
    onBack?: () => void
    showNav?: boolean
    headerRight?: ReactNode
    className?: string
}

export function Layout({
    children,
    title,
    showBack = false,
    onBack,
    showNav = true,
    headerRight,
    className,
}: LayoutProps): ReactNode {
    return (
        <div className="min-h-screen bg-telegram-bg flex flex-col">
            {title && (
                <Header
                    title={title}
                    showBack={showBack}
                    onBack={onBack}
                    rightElement={headerRight}
                />
            )}
            <main className={cn("flex-1 overflow-y-auto", showNav && "pb-20", className)}>
                {children}
            </main>
            {showNav && <BottomNav />}
        </div>
    )
}
