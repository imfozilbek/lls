import { type ReactNode, useEffect, useMemo, useState } from "react"

import { BusinessList } from "../../components/business/BusinessList.js"
import { BusinessTypeFilter } from "../../components/business/BusinessTypeFilter.js"
import { Layout } from "../../components/layout/Layout.js"
import { SearchInput } from "../../components/ui/SearchInput.js"
import { useBusinesses } from "../../hooks/useApi.js"
import { useAuthStore } from "../../stores/auth.store.js"

import type { BusinessDTO, BusinessType } from "@lls/core"

export function Home(): ReactNode {
    const { data: businesses, isLoading, error } = useBusinesses()
    const init = useAuthStore((state) => state.init)
    const [searchQuery, setSearchQuery] = useState("")
    const [typeFilter, setTypeFilter] = useState<BusinessType | "all">("all")

    useEffect(() => {
        void init()
    }, [init])

    const filteredBusinesses = useMemo((): BusinessDTO[] | null => {
        if (!businesses) {
            return null
        }

        let result = businesses

        // Filter by type
        if (typeFilter !== "all") {
            result = result.filter((business) => business.type === typeFilter)
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim()
            result = result.filter(
                (business) =>
                    business.name.toLowerCase().includes(query) ||
                    business.address.city.toLowerCase().includes(query) ||
                    business.address.street.toLowerCase().includes(query),
            )
        }

        return result
    }, [businesses, searchQuery, typeFilter])

    const handleSearchClear = (): void => {
        setSearchQuery("")
    }

    const handleTypeChange = (type: BusinessType | "all"): void => {
        setTypeFilter(type)
    }

    const hasActiveFilters = searchQuery || typeFilter !== "all"

    return (
        <Layout title="Магазины">
            <div className="p-4">
                {/* Search Bar */}
                <div className="mb-3">
                    <SearchInput
                        placeholder="Поиск магазинов..."
                        value={searchQuery}
                        onChange={(e): void => setSearchQuery(e.target.value)}
                        onClear={handleSearchClear}
                    />
                </div>

                {/* Business Type Filter */}
                <div className="mb-4">
                    <BusinessTypeFilter selected={typeFilter} onChange={handleTypeChange} />
                </div>

                {error && (
                    <div className="p-4 bg-red-50 rounded-xl text-red-600 text-sm mb-4">
                        {error}
                    </div>
                )}

                {/* Empty Results Info */}
                {hasActiveFilters && filteredBusinesses && filteredBusinesses.length === 0 && (
                    <div className="text-center py-8">
                        <div className="text-4xl mb-3">🔍</div>
                        <p className="text-telegram-hint">Ничего не найдено</p>
                        <button
                            onClick={(): void => {
                                setSearchQuery("")
                                setTypeFilter("all")
                            }}
                            className="mt-3 text-sm text-telegram-button"
                        >
                            Сбросить фильтры
                        </button>
                    </div>
                )}

                {/* Business List - only show if there are results or no filters active */}
                {(!hasActiveFilters || (filteredBusinesses && filteredBusinesses.length > 0)) && (
                    <BusinessList businesses={filteredBusinesses} isLoading={isLoading} />
                )}
            </div>
        </Layout>
    )
}
