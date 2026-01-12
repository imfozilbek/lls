import { Header } from "./Header.js"
import { Sidebar } from "./Sidebar.js"

import type { ReactNode } from "react"

interface LayoutProps {
    children: ReactNode
}

export function Layout({ children }: LayoutProps): ReactNode {
    return (
        <div className="min-h-screen bg-gray-50">
            <Sidebar />
            <div className="ml-64">
                <Header />
                <main className="p-6">{children}</main>
            </div>
        </div>
    )
}
