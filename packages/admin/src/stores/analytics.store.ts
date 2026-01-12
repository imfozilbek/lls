import { create } from "zustand"

import { analyticsApi } from "../lib/api-client.js"

import type { AnalyticsDashboardDTO, AnalyticsPeriod } from "@lls/core"

interface AnalyticsState {
    dashboard: AnalyticsDashboardDTO | null
    period: AnalyticsPeriod
    isLoading: boolean
    error: string | null
    fetchDashboard: (businessId: string) => Promise<void>
    setPeriod: (period: AnalyticsPeriod) => void
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
    dashboard: null,
    period: "week",
    isLoading: false,
    error: null,

    fetchDashboard: async (businessId: string): Promise<void> => {
        set({ isLoading: true, error: null })
        try {
            const { period } = get()
            const dashboard = await analyticsApi.getDashboard(businessId, period)
            set({ dashboard, isLoading: false })
        } catch (err) {
            const message = err instanceof Error ? err.message : "Не удалось загрузить аналитику"
            set({ error: message, isLoading: false })
        }
    },

    setPeriod: (period: AnalyticsPeriod): void => {
        set({ period })
    },
}))
