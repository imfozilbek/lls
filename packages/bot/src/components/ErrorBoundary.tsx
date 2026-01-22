import { Component } from "react"

import { Button } from "./ui/Button.js"

import type { ErrorInfo, ReactNode } from "react"

interface Props {
    children: ReactNode
    fallback?: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
        // Log to error reporting service in production
        // Errors are logged to state and shown in UI in dev mode
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null })
    }

    handleReload = (): void => {
        window.location.reload()
    }

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <div className="min-h-screen bg-telegram-bg flex items-center justify-center p-4">
                    <div className="text-center max-w-sm">
                        <div className="text-6xl mb-4">😕</div>
                        <h1 className="text-xl font-bold text-telegram-text mb-2">
                            Что-то пошло не так
                        </h1>
                        <p className="text-telegram-hint mb-6">
                            Произошла непредвиденная ошибка. Попробуйте обновить страницу.
                        </p>
                        <div className="flex flex-col gap-3">
                            <Button onClick={this.handleRetry} fullWidth>
                                Попробовать снова
                            </Button>
                            <Button onClick={this.handleReload} variant="secondary" fullWidth>
                                Обновить страницу
                            </Button>
                        </div>

                        {import.meta.env.DEV && this.state.error && (
                            <div className="mt-6 p-3 bg-red-50 rounded-lg text-left">
                                <p className="text-xs font-mono text-red-600 break-all">
                                    {this.state.error.message}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
