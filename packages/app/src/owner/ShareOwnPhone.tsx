import { useEffect, useRef, useState } from "react"

import { useT } from "../i18n/index.js"
import { api } from "../lib/api.js"
import { canRequestContact, haptic, requestContact } from "../lib/telegram.js"
import { useSession } from "../stores/session.js"
import { toast } from "../stores/toast.js"
import { PhoneIcon } from "../ui/icons.js"
import { Button } from "../ui/primitives.js"

/** The contact goes to the bot, then to the Worker: looked for this long. */
const POLL_MS = 1_500
const POLL_TRIES = 10

/**
 * «Raqamimni yuborish»: the owner's own Telegram number stands in for the shop's, in two taps and
 * nothing typed. Shown while the shop has no number to call at all.
 */
export function ShareOwnPhone(): React.JSX.Element | null {
    const s = useT().owner.settings
    const callPhone = useSession((state) => state.shop?.callPhone)
    const [waiting, setWaiting] = useState(false)
    const alive = useRef(true)
    useEffect(() => {
        alive.current = true
        return (): void => {
            alive.current = false
        }
    }, [])
    if (callPhone || !canRequestContact()) {
        return null
    }
    const share = async (): Promise<void> => {
        haptic.tap()
        if (!(await requestContact())) {
            return
        }
        setWaiting(true)
        for (let i = 0; i < POLL_TRIES && alive.current; i++) {
            await new Promise((resolve) => setTimeout(resolve, POLL_MS))
            const fresh = await api.shop().catch(() => null)
            if (fresh?.callPhone && alive.current) {
                useSession.getState().setShop(fresh)
                haptic.success()
                toast(s.ownPhoneSaved, "success")
                setWaiting(false)
                return
            }
        }
        if (alive.current) {
            setWaiting(false)
            toast(s.ownPhoneLate, "error")
        }
    }
    return (
        <div className="flex flex-col gap-1">
            <Button
                variant="secondary"
                icon={<PhoneIcon size={20} />}
                loading={waiting}
                onClick={(): void => void share()}
            >
                {s.ownPhone}
            </Button>
            <p className="px-1 text-sm text-tg-hint">{s.ownPhoneHint}</p>
        </div>
    )
}
