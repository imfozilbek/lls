import { BusinessType, type BusinessDTO } from "@lls/core"
import { type ReactNode } from "react"
import { useNavigate } from "react-router-dom"

import { hapticFeedback } from "../../lib/telegram.js"
import { getBusinessTypeLabel } from "../../lib/utils.js"
import { Badge } from "../ui/Badge.js"
import { Card } from "../ui/Card.js"

interface BusinessCardProps {
    business: BusinessDTO
}

export function BusinessCard({ business }: BusinessCardProps): ReactNode {
    const navigate = useNavigate()

    const handleClick = (): void => {
        hapticFeedback("light")
        void navigate(`/business/${business.id}`)
    }

    return (
        <Card interactive onClick={handleClick}>
            <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl bg-telegram-button/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">
                        {business.type === BusinessType.FOOD && "🍔"}
                        {business.type === BusinessType.CONSTRUCTION && "🏗️"}
                        {business.type === BusinessType.WATER && "💧"}
                    </span>
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-telegram-text truncate">{business.name}</h3>
                    <p className="text-sm text-telegram-hint truncate mt-0.5">
                        {business.address.street}, {business.address.city}
                    </p>
                    <div className="mt-2">
                        <Badge variant="primary">{getBusinessTypeLabel(business.type)}</Badge>
                    </div>
                </div>
                <svg
                    className="w-5 h-5 text-telegram-hint flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                    />
                </svg>
            </div>
        </Card>
    )
}
