import { type ReactNode, useEffect } from "react"

import { BusinessList } from "../../components/business/BusinessList.js"
import { Layout } from "../../components/layout/Layout.js"
import { useBusinesses } from "../../hooks/useApi.js"
import { useAuthStore } from "../../stores/auth.store.js"

export function Home(): ReactNode {
    const { data: businesses, isLoading, error } = useBusinesses()
    const init = useAuthStore((state) => state.init)

    useEffect(() => {
        void init()
    }, [init])

    return (
        <Layout title="Магазины">
            <div className="p-4">
                {error && (
                    <div className="p-4 bg-red-50 rounded-xl text-red-600 text-sm mb-4">
                        {error}
                    </div>
                )}
                <BusinessList businesses={businesses} isLoading={isLoading} />
            </div>
        </Layout>
    )
}
