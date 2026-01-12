import type { AnalyticsPeriod } from "../../dtos/analytics.dto.js"
import type { AnalyticsDateRange } from "../../ports/analytics-repository.js"

export function getDateRangeForPeriod(period: AnalyticsPeriod): AnalyticsDateRange {
    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)

    const startDate = new Date()
    startDate.setHours(0, 0, 0, 0)

    switch (period) {
        case "day":
            // Today only
            break
        case "week":
            // Last 7 days
            startDate.setDate(startDate.getDate() - 6)
            break
        case "month":
            // Last 30 days
            startDate.setDate(startDate.getDate() - 29)
            break
    }

    return { startDate, endDate }
}

export function parseDateRange(
    startDateStr?: string,
    endDateStr?: string,
): AnalyticsDateRange | null {
    if (!startDateStr || !endDateStr) {
        return null
    }

    const startDate = new Date(startDateStr)
    const endDate = new Date(endDateStr)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return null
    }

    startDate.setHours(0, 0, 0, 0)
    endDate.setHours(23, 59, 59, 999)

    return { startDate, endDate }
}
