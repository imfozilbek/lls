import { Button } from "./Button.js"

import type { ReactNode } from "react"

interface PaginationProps {
    page: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
    onPageChange: (page: number) => void
    isLoading?: boolean
}

export function Pagination({
    page,
    totalPages,
    hasNext,
    hasPrev,
    onPageChange,
    isLoading = false,
}: PaginationProps): ReactNode {
    if (totalPages <= 1) {
        return null
    }

    const getPageNumbers = (): (number | "...")[] => {
        const pages: (number | "...")[] = []
        const maxVisible = 5

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i)
            }
        } else {
            if (page <= 3) {
                for (let i = 1; i <= 4; i++) {
                    pages.push(i)
                }
                pages.push("...")
                pages.push(totalPages)
            } else if (page >= totalPages - 2) {
                pages.push(1)
                pages.push("...")
                for (let i = totalPages - 3; i <= totalPages; i++) {
                    pages.push(i)
                }
            } else {
                pages.push(1)
                pages.push("...")
                pages.push(page - 1)
                pages.push(page)
                pages.push(page + 1)
                pages.push("...")
                pages.push(totalPages)
            }
        }

        return pages
    }

    return (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-500">
                Страница {page} из {totalPages}
            </div>
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={(): void => onPageChange(page - 1)}
                    disabled={!hasPrev || isLoading}
                >
                    Назад
                </Button>

                {getPageNumbers().map((pageNum, index) =>
                    pageNum === "..." ? (
                        <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
                            ...
                        </span>
                    ) : (
                        <button
                            key={pageNum}
                            onClick={(): void => onPageChange(pageNum)}
                            disabled={isLoading}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                                pageNum === page
                                    ? "bg-blue-600 text-white"
                                    : "text-gray-700 hover:bg-gray-100"
                            }`}
                        >
                            {pageNum}
                        </button>
                    ),
                )}

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={(): void => onPageChange(page + 1)}
                    disabled={!hasNext || isLoading}
                >
                    Далее
                </Button>
            </div>
        </div>
    )
}
