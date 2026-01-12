import { type ReactNode } from "react"

import { cn } from "../../lib/utils.js"

type OrderStatus =
    | "PENDING"
    | "ACCEPTED"
    | "PREPARING"
    | "READY"
    | "PICKED_UP"
    | "DELIVERED"
    | "CANCELLED"

interface TimelineStep {
    status: OrderStatus
    label: string
    icon: ReactNode
}

const steps: TimelineStep[] = [
    {
        status: "PENDING",
        label: "Ожидает подтверждения",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>
        ),
    },
    {
        status: "ACCEPTED",
        label: "Принят",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                />
            </svg>
        ),
    },
    {
        status: "PREPARING",
        label: "Готовится",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                />
            </svg>
        ),
    },
    {
        status: "READY",
        label: "Готов к выдаче",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
            </svg>
        ),
    },
    {
        status: "PICKED_UP",
        label: "В пути",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                />
            </svg>
        ),
    },
    {
        status: "DELIVERED",
        label: "Доставлен",
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>
        ),
    },
]

interface OrderTimelineProps {
    currentStatus: OrderStatus | string
}

export function OrderTimeline({ currentStatus }: OrderTimelineProps): ReactNode {
    if (currentStatus === "CANCELLED") {
        return (
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <svg
                        className="w-5 h-5 text-red-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </div>
                <div>
                    <p className="font-medium text-red-800">Заказ отменён</p>
                    <p className="text-sm text-red-600">Свяжитесь с поддержкой для деталей</p>
                </div>
            </div>
        )
    }

    const currentIndex = steps.findIndex((step) => step.status === currentStatus)

    return (
        <div className="space-y-0">
            {steps.map((step, index) => {
                const isCompleted = index < currentIndex
                const isCurrent = index === currentIndex
                const isPending = index > currentIndex

                return (
                    <div key={step.status} className="flex items-start gap-3">
                        {/* Line and Circle */}
                        <div className="flex flex-col items-center">
                            <div
                                className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center",
                                    isCompleted && "bg-green-100 text-green-600",
                                    isCurrent && "bg-telegram-button text-telegram-buttonText",
                                    isPending && "bg-telegram-secondary text-telegram-hint",
                                )}
                            >
                                {step.icon}
                            </div>
                            {index < steps.length - 1 && (
                                <div
                                    className={cn(
                                        "w-0.5 h-8",
                                        index < currentIndex
                                            ? "bg-green-300"
                                            : "bg-telegram-secondary",
                                    )}
                                />
                            )}
                        </div>

                        {/* Label */}
                        <div className="pt-2">
                            <p
                                className={cn(
                                    "font-medium",
                                    isCompleted && "text-green-600",
                                    isCurrent && "text-telegram-text",
                                    isPending && "text-telegram-hint",
                                )}
                            >
                                {step.label}
                            </p>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
