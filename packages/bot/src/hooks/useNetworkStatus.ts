import { useEffect, useState, useCallback } from "react"

interface NetworkStatus {
    isOnline: boolean
    isOffline: boolean
    wasOffline: boolean
}

/**
 * Hook to detect network connectivity status
 * Handles online/offline events and tracks if connection was lost
 */
export function useNetworkStatus(): NetworkStatus {
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== "undefined" ? navigator.onLine : true,
    )
    const [wasOffline, setWasOffline] = useState(false)

    const handleOnline = useCallback((): void => {
        setIsOnline(true)
    }, [])

    const handleOffline = useCallback((): void => {
        setIsOnline(false)
        setWasOffline(true)
    }, [])

    useEffect((): (() => void) => {
        window.addEventListener("online", handleOnline)
        window.addEventListener("offline", handleOffline)

        return (): void => {
            window.removeEventListener("online", handleOnline)
            window.removeEventListener("offline", handleOffline)
        }
    }, [handleOnline, handleOffline])

    return {
        isOnline,
        isOffline: !isOnline,
        wasOffline,
    }
}
