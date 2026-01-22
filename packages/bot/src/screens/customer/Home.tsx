import { type ReactNode, useEffect, useMemo, useState } from "react"

import { BusinessList } from "../../components/business/BusinessList.js"
import { Layout } from "../../components/layout/Layout.js"
import { SearchInput } from "../../components/ui/SearchInput.js"
import { useBusinesses } from "../../hooks/useApi.js"
import { useAuthStore } from "../../stores/auth.store.js"

import type { BusinessDTO } from "@lls/core"

export function Home(): ReactNode {
    const { data: businesses, isLoading, error } = useBusinesses()
    const init = useAuthStore((state) => state.init)
    const [searchQuery, setSearchQuery] = useState("")

    useEffect(() => {
        void init()
    }, [init])

    const filteredBusinesses = useMemo((): BusinessDTO[] | null => {
        if (!businesses) {
            return null
        }
        if (!searchQuery.trim()) {
            return businesses
        }

        const query = searchQuery.toLowerCase().trim()
        return businesses.filter(
            (business) =>
                business.name.toLowerCase().includes(query) ||
                business.address.city.toLowerCase().includes(query) ||
                business.address.street.toLowerCase().includes(query),
        )
    }, [businesses, searchQuery])

    const handleSearchClear = (): void => {
        setSearchQuery("")
    }

    return (
        <Layout title="Магазины">
            <div className="p-4">
                {/* Search Bar */}
                <div className="mb-4">
                    <SearchInput
                        placeholder="Поиск магазинов..."
                        value={searchQuery}
                        onChange={(e): void => setSearchQuery(e.target.value)}
                        onClear={handleSearchClear}
                    />
                </div>

                {error && (
                    <div className="p-4 bg-red-50 rounded-xl text-red-600 text-sm mb-4">
                        {error}
                    </div>
                )}

                {/* Search Results Info */}
                {searchQuery && filteredBusinesses && filteredBusinesses.length === 0 && (
                    <div className="text-center py-8">
                        <div className="text-4xl mb-3">🔍</div>
                        <p className="text-telegram-hint">
                            По запросу &quot;{searchQuery}&quot; ничего не найдено
                        </p>
                        <button
                            onClick={handleSearchClear}
                            className="mt-3 text-sm text-telegram-button"
                        >
                            Сбросить поиск
                        </button>
                    </div>
                )}

                {/* Business List - only show if there are results or no search query */}
                {(!searchQuery || (filteredBusinesses && filteredBusinesses.length > 0)) && (
                    <BusinessList businesses={filteredBusinesses} isLoading={isLoading} />
                )}
            </div>
        </Layout>
    )
}
