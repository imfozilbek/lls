import { type ReactNode } from "react"

import { Skeleton } from "../ui/Loading.js"

import { BusinessCard } from "./BusinessCard.js"

import type { BusinessDTO } from "@lls/core"

interface BusinessListProps {
    businesses: BusinessDTO[] | null
    isLoading?: boolean
}

export function BusinessList({ businesses, isLoading }: BusinessListProps): ReactNode {
    if (isLoading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-4 rounded-xl bg-telegram-secondary">
                        <div className="flex items-start gap-3">
                            <Skeleton className="w-14 h-14 rounded-xl" />
                            <div className="flex-1">
                                <Skeleton className="h-5 w-3/4 mb-2" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (!businesses || businesses.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-4xl mb-3">🏪</div>
                <p className="text-telegram-hint">Нет доступных магазинов</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {businesses.map((business) => (
                <BusinessCard key={business.id} business={business} />
            ))}
        </div>
    )
}
