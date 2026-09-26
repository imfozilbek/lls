import { useState } from "react"

import { errorText, useT } from "../i18n/index.js"
import { ApiError } from "../lib/api.js"
import { toast } from "../stores/toast.js"

import { Button } from "./primitives.js"

import type { PagedList } from "../lib/paged.js"

/** "Show more" under a paginated list. Hidden when everything is loaded. */
export function LoadMore<T>({ list }: { list: PagedList<T> }): React.JSX.Element | null {
    const t = useT()
    const [busy, setBusy] = useState(false)
    if (!list.hasMore) {
        return null
    }
    const more = async (): Promise<void> => {
        setBusy(true)
        try {
            await list.loadMore()
        } catch (caught) {
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
        } finally {
            setBusy(false)
        }
    }
    return (
        <Button
            variant="secondary"
            className="mt-3 w-full"
            loading={busy || list.loadingMore}
            onClick={(): void => void more()}
        >
            {t.common.more}
        </Button>
    )
}
