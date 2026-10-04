import { useEffect, useRef, useState } from "react"

import { errorText, fill, useT } from "../i18n/index.js"
import { ApiError, api } from "../lib/api.js"
import { canRequestChat, haptic, openTelegramLink, requestChat } from "../lib/telegram.js"
import { toast } from "../stores/toast.js"
import { BotIcon, CheckIcon } from "../ui/icons.js"
import { Button, Field, Spinner, TextInput } from "../ui/primitives.js"

import type { ManagedBot } from "../lib/api.js"

/**
 * After the «create a bot» window, Telegram tells the Worker (`managed_bot`) a moment later.
 * A few short checks, then a «check again» button: never a steady poll.
 */
const CHECK_DELAYS_MS = [700, 1200, 2000, 3000, 4500] as const

/** Same shape the Worker accepts; checked here so the owner sees the mistake at once. */
export const TOKEN_PATTERN = /^\d{5,15}:[A-Za-z0-9_-]{30,64}$/

export type BotMode = "create" | "token"

/** `idle`: nothing yet; `opening`: preparing the window; `waiting`: checking; `missing`: not yet. */
export type BotPhase = "idle" | "opening" | "waiting" | "missing"

export interface ManagedBotFlow {
    phase: BotPhase
    bot: ManagedBot | null
    /** Opens Telegram's «create a bot» window (or its t.me/newbot link) for this shop name. */
    create(): Promise<void>
    /** Opens the same window by the link: for Telegram apps where the window did not open. */
    openLink(): Promise<void>
    checkAgain(): Promise<void>
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Step «Bot» without a token: Zumda Business prepares Telegram's «create a bot» window, the bot is
 * created in the owner's own account, and Zumda gets its token by itself.
 */
export function useManagedBot(name: string, onBot: (bot: ManagedBot) => void): ManagedBotFlow {
    const t = useT()
    const [phase, setPhase] = useState<BotPhase>("idle")
    const [bot, setBot] = useState<ManagedBot | null>(null)
    const known = useRef<Set<number>>(new Set())
    const found = useRef(onBot)
    found.current = onBot

    const take = (next: ManagedBot): void => {
        haptic.success()
        setBot(next)
        setPhase("idle")
        found.current(next)
    }

    // A bot created earlier (the owner left and came back by «Davom etish»): take it at once.
    // Once, on opening: `take` only reads refs and setters.
    useEffect(() => {
        void api.platform
            .managedBots()
            .then((bots) => {
                const ready = bots[bots.length - 1]
                known.current = new Set(bots.map((b) => b.botId))
                if (ready) {
                    take(ready)
                }
            })
            .catch(() => undefined)
    }, [])

    const check = async (delays: readonly number[]): Promise<void> => {
        setPhase("waiting")
        for (const delay of delays) {
            await sleep(delay)
            const bots = await api.platform.managedBots().catch(() => [])
            const fresh = bots.find((b) => !known.current.has(b.botId))
            if (fresh) {
                take(fresh)
                return
            }
        }
        setPhase("missing")
    }

    const prepare = async (): Promise<{ preparedId: string; link: string } | null> => {
        setPhase("opening")
        try {
            return await api.platform.prepareManagedBot(name.trim())
        } catch (caught) {
            haptic.error()
            toast(errorText(t, caught instanceof ApiError ? caught.code : "generic"), "error")
            setPhase("idle")
            return null
        }
    }

    const openLink = async (): Promise<void> => {
        const prepared = await prepare()
        if (prepared) {
            openTelegramLink(prepared.link)
            await check(CHECK_DELAYS_MS)
        }
    }

    const create = async (): Promise<void> => {
        haptic.tap()
        if (!canRequestChat()) {
            await openLink()
            return
        }
        const prepared = await prepare()
        if (!prepared) {
            return
        }
        // Closed without creating: back to the start, nothing to check.
        if (!(await requestChat(prepared.preparedId))) {
            setPhase("idle")
            return
        }
        await check(CHECK_DELAYS_MS)
    }

    return { phase, bot, create, openLink, checkAgain: (): Promise<void> => check([0]) }
}

function BotPreview({ name, bot }: { name: string; bot: ManagedBot | null }): React.JSX.Element {
    const t = useT().onboarding
    return (
        <div className="flex items-center gap-3 rounded-tile bg-tg-secondary p-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-lg font-bold text-brand-ink">
                {name.trim().charAt(0).toUpperCase() || <BotIcon size={22} />}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{name.trim()}</span>
                {bot ? (
                    <span className="block animate-fade-in text-sm font-medium text-tg-text [overflow-wrap:anywhere]">
                        {fill(t.botCreated, { bot: `@${bot.username}` })}
                    </span>
                ) : (
                    <span className="block text-sm text-tg-hint">{t.botPreviewHint}</span>
                )}
            </span>
            {bot ? (
                <span className="grid h-8 w-8 animate-pop place-items-center rounded-full bg-success/15 text-success">
                    <CheckIcon size={18} strokeWidth={2.5} />
                </span>
            ) : null}
        </div>
    )
}

function Status({ flow }: { flow: ManagedBotFlow }): React.JSX.Element | null {
    const t = useT().onboarding
    if (flow.phase === "waiting" && !flow.bot) {
        return (
            <p className="flex animate-fade-in items-center gap-2 text-tg-hint" role="status">
                <Spinner className="text-brand" />
                {t.botWaiting}
            </p>
        )
    }
    if (flow.phase === "missing" && !flow.bot) {
        return (
            <div className="flex animate-rise flex-col items-start gap-3" role="status">
                <p className="text-tg-hint">{t.botMissing}</p>
                <Button variant="secondary" onClick={(): void => void flow.checkAgain()}>
                    {t.botCheckAgain}
                </Button>
            </div>
        )
    }
    return null
}

function TokenFields({
    token,
    onToken,
}: {
    token: string
    onToken(token: string): void
}): React.JSX.Element {
    const t = useT().onboarding
    return (
        <>
            <ol className="flex flex-col gap-3">
                {t.botSteps.map((text, index) => (
                    <li key={text} className="flex gap-3">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/15 text-sm font-bold">
                            {index + 1}
                        </span>
                        <span className="pt-0.5">{text}</span>
                    </li>
                ))}
            </ol>
            <Button
                variant="secondary"
                icon={<BotIcon size={20} className="text-brand" />}
                onClick={(): void => openTelegramLink("https://t.me/BotFather")}
            >
                {t.openBotFather}
            </Button>
            <Field label={t.token} htmlFor="bot-token">
                <div className="flex gap-2">
                    <TextInput
                        id="bot-token"
                        value={token}
                        placeholder={t.tokenPlaceholder}
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        className="min-w-0 flex-1 font-mono text-sm"
                        onChange={(e): void => onToken(e.target.value.trim())}
                    />
                    <PasteButton onPaste={onToken} />
                </div>
            </Field>
        </>
    )
}

/** The token comes from another chat: one tap pastes it, where the phone allows reading it. */
function PasteButton({ onPaste }: { onPaste(text: string): void }): React.JSX.Element {
    const t = useT().onboarding
    const paste = async (): Promise<void> => {
        try {
            const text = (await navigator.clipboard.readText()).trim()
            if (text) {
                haptic.success()
                onPaste(text)
                return
            }
        } catch {
            // Telegram on some phones does not let a page read the clipboard: say how by hand.
        }
        haptic.error()
        toast(t.pasteFailed)
    }
    return (
        <Button variant="secondary" className="shrink-0" onClick={(): void => void paste()}>
            {t.paste}
        </Button>
    )
}

function SwitchLink({ text, onClick }: { text: string; onClick(): void }): React.JSX.Element {
    return (
        <button
            type="button"
            onClick={(): void => {
                haptic.select()
                onClick()
            }}
            className="tap -mx-1 self-start rounded-control px-1 py-2 font-semibold text-brand"
        >
            {text}
        </button>
    )
}

/** Step «Bot»: one button creates it; «Menda bot bor» keeps the BotFather token way. */
export function BotStep({
    name,
    mode,
    token,
    flow,
    onMode,
    onToken,
}: {
    name: string
    mode: BotMode
    token: string
    flow: ManagedBotFlow
    onMode(mode: BotMode): void
    onToken(token: string): void
}): React.JSX.Element {
    const t = useT().onboarding
    if (mode === "token") {
        return (
            <>
                <h1 className="text-2xl font-bold">{t.tokenTitle}</h1>
                <TokenFields token={token} onToken={onToken} />
                <SwitchLink text={t.botCreateInstead} onClick={(): void => onMode("create")} />
            </>
        )
    }
    const busy = flow.phase === "opening" || flow.phase === "waiting"
    return (
        <>
            <h1 className="text-2xl font-bold">{t.botTitle}</h1>
            <p className="text-tg-hint">{t.botText}</p>
            <BotPreview name={name} bot={flow.bot} />
            <Status flow={flow} />
            {flow.bot ? null : (
                <div className="flex flex-col">
                    {canRequestChat() ? (
                        <SwitchLink
                            text={t.botByLink}
                            onClick={(): void => {
                                if (!busy) {
                                    void flow.openLink()
                                }
                            }}
                        />
                    ) : null}
                    <SwitchLink text={t.botHaveOne} onClick={(): void => onMode("token")} />
                </div>
            )}
        </>
    )
}
