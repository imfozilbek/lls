import { forwardRef, useEffect, useState } from "react"

import { useLanguage, useT } from "../i18n/index.js"
import { cn } from "../lib/cn.js"
import { currencyOf } from "../lib/format.js"
import { haptic } from "../lib/telegram.js"

import { MinusIcon, PlusIcon } from "./icons.js"

import type {
    ButtonHTMLAttributes,
    InputHTMLAttributes,
    ReactNode,
    TextareaHTMLAttributes,
} from "react"

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"

const VARIANTS: Record<ButtonVariant, string> = {
    primary: "bg-brand text-brand-ink shadow-[0_6px_16px_-8px_rgb(var(--brand-rgb)/0.8)]",
    secondary: "bg-tg-secondary text-tg-text",
    ghost: "bg-transparent text-brand",
    danger: "bg-danger/10 text-tg-destructive",
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant
    size?: "md" | "lg"
    loading?: boolean
    icon?: ReactNode
}

export function Button({
    variant = "primary",
    size = "md",
    loading = false,
    icon,
    className,
    children,
    disabled,
    ...props
}: ButtonProps): React.JSX.Element {
    return (
        <button
            type="button"
            className={cn(
                "tap inline-flex items-center justify-center gap-2 rounded-control font-semibold",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
                size === "lg" ? "h-[52px] px-5 text-lg" : "h-11 px-4 text-base",
                VARIANTS[variant],
                className,
            )}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            {...props}
        >
            {loading ? <Spinner /> : icon}
            {children}
        </button>
    )
}

export function Spinner({ className }: { className?: string }): React.JSX.Element {
    return (
        <span
            className={cn(
                "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent",
                className,
            )}
            aria-hidden="true"
        />
    )
}

/** "−  2  +" that grows out of the "+" button. The number bumps on every change. */
export function Stepper({
    quantity,
    onAdd,
    onRemove,
    size = "md",
    label,
}: {
    quantity: number
    onAdd(): void
    onRemove(): void
    size?: "sm" | "md"
    label: string
}): React.JSX.Element {
    const [bumpKey, setBumpKey] = useState(0)
    useEffect(() => setBumpKey((k) => k + 1), [quantity])
    const box = size === "sm" ? "h-9 w-9" : "h-10 w-10"
    return (
        <div
            className="inline-flex animate-pop items-center rounded-full bg-brand text-brand-ink"
            role="group"
            aria-label={label}
        >
            <button
                type="button"
                className={cn("tap grid place-items-center rounded-full", box)}
                onClick={(): void => {
                    haptic.tap()
                    onRemove()
                }}
                aria-label="−"
            >
                <MinusIcon size={18} strokeWidth={2.25} />
            </button>
            <span
                key={bumpKey}
                className="min-w-6 animate-bump text-center font-semibold tabular-nums"
                aria-live="polite"
            >
                {quantity}
            </span>
            <button
                type="button"
                className={cn("tap grid place-items-center rounded-full", box)}
                onClick={(): void => {
                    haptic.tap()
                    onAdd()
                }}
                aria-label="+"
            >
                <PlusIcon size={18} strokeWidth={2.25} />
            </button>
        </div>
    )
}

export function Skeleton({ className }: { className?: string }): React.JSX.Element {
    return <div className={cn("skeleton", className)} aria-hidden="true" />
}

export function Field({
    label,
    hint,
    children,
    htmlFor,
}: {
    label: string
    hint?: ReactNode
    children: ReactNode
    htmlFor?: string
}): React.JSX.Element {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={htmlFor} className="px-1 text-sm font-medium text-tg-subtitle">
                {label}
            </label>
            {children}
            {hint ? <p className="px-1 text-sm text-tg-hint">{hint}</p> : null}
        </div>
    )
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
    function TextInput({ className, ...props }, ref) {
        return <input ref={ref} className={cn("field", className)} {...props} />
    },
)

export function TextArea({
    className,
    ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>): React.JSX.Element {
    return <textarea className={cn("field min-h-[84px] resize-none", className)} {...props} />
}

/** Integer sum input: digits only, grouped while typing, value in UZS. */
export function MoneyInput({
    value,
    onChange,
    id,
    placeholder,
}: {
    value: number | null
    onChange(value: number | null): void
    id?: string
    placeholder?: string
}): React.JSX.Element {
    const language = useLanguage()
    const shown = value === null ? "" : String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
    return (
        <div className="relative">
            <input
                id={id}
                inputMode="numeric"
                className="field pr-16 tabular-nums"
                value={shown}
                placeholder={placeholder}
                onChange={(event): void => {
                    const digits = event.target.value.replace(/\D/g, "").slice(0, 10)
                    onChange(digits === "" ? null : Number(digits))
                }}
            />
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-tg-hint">
                {currencyOf(language)}
            </span>
        </div>
    )
}

export function Switch({
    checked,
    onChange,
    label,
}: {
    checked: boolean
    onChange(checked: boolean): void
    label: string
}): React.JSX.Element {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={(): void => {
                haptic.select()
                onChange(!checked)
            }}
            className={cn(
                "relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200 ease-out-quart",
                checked ? "bg-brand" : "bg-tg-hint/30",
            )}
        >
            <span
                className={cn(
                    "absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-out-quart",
                    checked && "translate-x-5",
                )}
            />
        </button>
    )
}

export function Segmented<T extends string>({
    value,
    options,
    onChange,
}: {
    value: T
    options: readonly { value: T; label: string }[]
    onChange(value: T): void
}): React.JSX.Element {
    return (
        <div className="flex rounded-control bg-tg-secondary p-1" role="tablist">
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={option.value === value}
                    onClick={(): void => {
                        haptic.select()
                        onChange(option.value)
                    }}
                    className={cn(
                        "tap h-9 flex-1 rounded-[0.625rem] text-sm font-semibold transition-colors duration-200",
                        option.value === value
                            ? "bg-tg-bg text-tg-text shadow-sm"
                            : "text-tg-subtitle",
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}

/** Empty and error states: a small drawing, one sentence, one way forward. */
export function EmptyState({
    art,
    title,
    text,
    action,
}: {
    art: ReactNode
    title: string
    text?: string
    action?: ReactNode
}): React.JSX.Element {
    return (
        <div className="flex animate-rise flex-col items-center px-8 py-14 text-center">
            <div className="mb-5 grid h-24 w-24 place-items-center rounded-[2rem] bg-brand/10 text-brand">
                {art}
            </div>
            <h2 className="text-xl font-semibold">{title}</h2>
            {text ? <p className="mt-2 max-w-[28ch] text-tg-hint">{text}</p> : null}
            {action ? <div className="mt-6">{action}</div> : null}
        </div>
    )
}

export function Section({
    title,
    children,
    className,
}: {
    title?: string
    children: ReactNode
    className?: string
}): React.JSX.Element {
    return (
        <section className={cn("flex flex-col gap-3", className)}>
            {title ? (
                <h2 className="px-1 text-sm font-semibold text-tg-subtitle">{title}</h2>
            ) : null}
            {children}
        </section>
    )
}

export function PoweredBy(): React.JSX.Element {
    const t = useT()
    return (
        <p className="py-6 text-center text-xs tracking-wide text-tg-hint/80">
            {t.common.poweredBy}
        </p>
    )
}
