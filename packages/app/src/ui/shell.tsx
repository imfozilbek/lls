import { useMainActionStore } from "../lib/main-button.js"
import { hasNativeMainButton } from "../lib/telegram.js"
import { useToasts } from "../stores/toast.js"

import { CheckIcon, CloseIcon } from "./icons.js"
import { Button } from "./primitives.js"

/** In-app stand-in for Telegram's MainButton (web version, old clients, screenshots). */
export function BottomBar(): React.JSX.Element | null {
    const action = useMainActionStore((state) => state.action)
    if (!action || hasNativeMainButton()) {
        return null
    }
    return (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-bar animate-rise bg-gradient-to-t from-tg-bg via-tg-bg/95 to-tg-bg/0 px-4 pt-6">
            <Button
                size="lg"
                className="w-full"
                loading={action.loading}
                disabled={action.disabled}
                onClick={action.onClick}
            >
                {action.text}
            </Button>
        </div>
    )
}

/** Reserves room under the content so the in-app bottom bar never covers it. */
export function BottomSpacer(): React.JSX.Element {
    const hasAction = useMainActionStore((state) => state.action !== null)
    return (
        <div aria-hidden="true" className={hasAction && !hasNativeMainButton() ? "h-24" : "h-4"} />
    )
}

export function ToastHost(): React.JSX.Element {
    const toasts = useToasts((state) => state.toasts)
    const dismiss = useToasts((state) => state.dismiss)
    return (
        <div
            className="pointer-events-none fixed inset-x-0 top-0 z-toast flex flex-col items-center gap-2 px-4 pt-3"
            aria-live="polite"
        >
            {toasts.map((toast) => (
                <button
                    type="button"
                    key={toast.id}
                    onClick={(): void => dismiss(toast.id)}
                    className="pointer-events-auto flex w-full max-w-md animate-rise items-center gap-3 rounded-control bg-tg-text px-4 py-3 text-left text-sm font-medium text-tg-bg shadow-lg"
                >
                    <span
                        className={
                            toast.tone === "error"
                                ? "text-danger"
                                : toast.tone === "success"
                                  ? "text-success"
                                  : "text-tg-bg"
                        }
                    >
                        {toast.tone === "error" ? <CloseIcon size={18} /> : <CheckIcon size={18} />}
                    </span>
                    <span className="flex-1">{toast.text}</span>
                </button>
            ))}
        </div>
    )
}
