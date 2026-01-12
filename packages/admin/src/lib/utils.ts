import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs))
}

export function formatMoney(amount: number, currency = "UZS"): string {
    return new Intl.NumberFormat("uz-UZ", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount)
}

export function formatDate(date: string | Date): string {
    const d = typeof date === "string" ? new Date(date) : date
    return new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d)
}

export function formatShortDate(date: string | Date): string {
    const d = typeof date === "string" ? new Date(date) : date
    return new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "short",
    }).format(d)
}

export function formatRelativeTime(date: string | Date): string {
    const d = typeof date === "string" ? new Date(date) : date
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) {
        return "только что"
    }
    if (diffMins < 60) {
        return `${diffMins} мин назад`
    }
    if (diffHours < 24) {
        return `${diffHours} ч назад`
    }
    if (diffDays < 7) {
        return `${diffDays} дн назад`
    }
    return formatDate(d)
}

export function getBusinessTypeLabel(type: string): string {
    const labels: Record<string, string> = {
        FOOD: "Еда",
        CONSTRUCTION: "Стройматериалы",
        WATER: "Вода и напитки",
    }
    return labels[type] || type
}

export function getOrderStatusLabel(status: string): string {
    const labels: Record<string, string> = {
        PENDING: "Ожидает",
        ACCEPTED: "Принят",
        PREPARING: "Готовится",
        READY: "Готов к выдаче",
        PICKED_UP: "В пути",
        DELIVERED: "Доставлен",
        CANCELLED: "Отменён",
    }
    return labels[status] || status
}

export function getOrderStatusColor(status: string): string {
    const colors: Record<string, string> = {
        PENDING: "bg-yellow-100 text-yellow-800",
        ACCEPTED: "bg-blue-100 text-blue-800",
        PREPARING: "bg-purple-100 text-purple-800",
        READY: "bg-green-100 text-green-800",
        PICKED_UP: "bg-indigo-100 text-indigo-800",
        DELIVERED: "bg-emerald-100 text-emerald-800",
        CANCELLED: "bg-red-100 text-red-800",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
}

export function isToday(date: string | Date): boolean {
    const d = typeof date === "string" ? new Date(date) : date
    const today = new Date()
    return d.toDateString() === today.toDateString()
}
