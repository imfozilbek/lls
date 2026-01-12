import { create } from "zustand"
import { persist } from "zustand/middleware"

import { businessApi } from "../lib/api-client.js"

import type { BusinessDTO } from "@lls/core"

interface AuthState {
    business: BusinessDTO | null
    isLoading: boolean
    error: string | null
    login: (telegramId: number) => Promise<void>
    logout: () => void
    updateBusiness: (data: Partial<BusinessDTO>) => Promise<void>
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            business: null,
            isLoading: false,
            error: null,

            login: async (telegramId: number): Promise<void> => {
                set({ isLoading: true, error: null })
                try {
                    localStorage.setItem("business_telegram_id", String(telegramId))
                    const business = await businessApi.getByTelegramId(telegramId)
                    set({ business, isLoading: false })
                } catch (err) {
                    localStorage.removeItem("business_telegram_id")
                    const message = err instanceof Error ? err.message : "Не удалось войти"
                    set({ error: message, isLoading: false, business: null })
                    throw err
                }
            },

            logout: (): void => {
                localStorage.removeItem("business_telegram_id")
                set({ business: null, error: null })
            },

            updateBusiness: async (data: Partial<BusinessDTO>): Promise<void> => {
                const { business } = get()
                if (!business) {
                    return
                }

                set({ isLoading: true, error: null })
                try {
                    const updated = await businessApi.update(business.id, data)
                    set({ business: updated, isLoading: false })
                } catch (err) {
                    const message = err instanceof Error ? err.message : "Не удалось обновить"
                    set({ error: message, isLoading: false })
                    throw err
                }
            },
        }),
        {
            name: "admin-auth",
            partialize: (state) => ({ business: state.business }),
        },
    ),
)
