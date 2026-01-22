import { create } from "zustand"

import { customerApi } from "../lib/api-client.js"

import type { CustomerDTO } from "@lls/core"

interface TelegramUser {
    id: number
    first_name: string
    last_name?: string
    username?: string
    language_code?: string
}

interface AuthState {
    customer: CustomerDTO | null
    telegramUser: TelegramUser | null
    isLoading: boolean
    isInitialized: boolean
    error: string | null
}

interface AuthActions {
    init: () => Promise<void>
    updateCustomer: (data: {
        name?: string
        phone?: string
        address?: { street: string; city: string }
    }) => Promise<void>
    reset: () => void
}

type AuthStore = AuthState & AuthActions

const initialState: AuthState = {
    customer: null,
    telegramUser: null,
    isLoading: false,
    isInitialized: false,
    error: null,
}

export const useAuthStore = create<AuthStore>((set, get) => ({
    ...initialState,

    init: async (): Promise<void> => {
        if (get().isInitialized) {
            return
        }

        set({ isLoading: true, error: null })

        try {
            const tg = window.Telegram?.WebApp
            if (!tg?.initDataUnsafe?.user) {
                set({ isLoading: false, isInitialized: true })
                return
            }

            const user = tg.initDataUnsafe.user as TelegramUser
            set({ telegramUser: user })

            const customer = await customerApi.getOrCreate({
                telegramId: user.id,
                name: [user.first_name, user.last_name].filter(Boolean).join(" "),
                phone: "",
                address: { street: "", city: "" },
            })

            set({ customer, isLoading: false, isInitialized: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to initialize"
            set({ error: message, isLoading: false, isInitialized: true })
        }
    },

    updateCustomer: async (data): Promise<void> => {
        set({ isLoading: true, error: null })

        try {
            const updated = await customerApi.updateMe(data)
            set({ customer: updated, isLoading: false })
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to update"
            set({ error: message, isLoading: false })
        }
    },

    reset: (): void => {
        set(initialState)
    },
}))
