import { Injectable } from "@nestjs/common"

import { logger } from "../common/logger.js"
import { configuration } from "../config/configuration.js"

import type { OrderDTO, OrderStatus } from "@lls/core"

export interface NotificationPayload {
    chatId: number
    message: string
    parseMode?: "HTML" | "Markdown"
}

type TelegramIdLike = number | { value: number }

function extractTelegramId(id: TelegramIdLike): number {
    return typeof id === "number" ? id : id.value
}

/**
 * Service for sending Telegram bot notifications
 */
@Injectable()
export class TelegramNotificationService {
    private readonly botToken: string
    private readonly baseUrl: string

    constructor() {
        const config = configuration()
        this.botToken = config.telegramBotToken
        this.baseUrl = `https://api.telegram.org/bot${this.botToken}`
    }

    /**
     * Send a message via Telegram Bot API
     */
    async sendMessage(payload: NotificationPayload): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: payload.chatId,
                    text: payload.message,
                    parse_mode: payload.parseMode ?? "HTML",
                }),
            })

            if (!response.ok) {
                const error = await response.text()
                logger.error(`Failed to send Telegram notification: ${error}`)
                return false
            }

            return true
        } catch (error) {
            logger.error(`Telegram notification error: ${error instanceof Error ? error.message : String(error)}`)
            return false
        }
    }

    /**
     * Send order confirmation to customer
     */
    async sendOrderConfirmation(
        customerTelegramId: TelegramIdLike,
        order: OrderDTO,
        businessName: string,
    ): Promise<boolean> {
        const message = this.formatOrderConfirmation(order, businessName)
        return this.sendMessage({
            chatId: extractTelegramId(customerTelegramId),
            message,
        })
    }

    /**
     * Send order status change notification
     */
    async sendStatusChangeNotification(
        telegramId: TelegramIdLike,
        orderId: string,
        previousStatus: OrderStatus,
        newStatus: OrderStatus,
    ): Promise<boolean> {
        const message = this.formatStatusChange(orderId, previousStatus, newStatus)
        return this.sendMessage({
            chatId: extractTelegramId(telegramId),
            message,
        })
    }

    /**
     * Send courier assigned notification to customer
     */
    async sendCourierAssignedNotification(
        customerTelegramId: TelegramIdLike,
        orderId: string,
        courierName: string,
    ): Promise<boolean> {
        const message = `🚴 <b>Курьер назначен!</b>

Заказ: #${orderId.slice(-6).toUpperCase()}
Курьер: ${courierName}

Ваш заказ уже в пути!`

        return this.sendMessage({
            chatId: extractTelegramId(customerTelegramId),
            message,
        })
    }

    /**
     * Send delivery complete notification to customer
     */
    async sendDeliveryCompleteNotification(
        customerTelegramId: TelegramIdLike,
        orderId: string,
    ): Promise<boolean> {
        const message = `✅ <b>Заказ доставлен!</b>

Заказ: #${orderId.slice(-6).toUpperCase()}

Спасибо за заказ! Ждём вас снова! 🙏`

        return this.sendMessage({
            chatId: extractTelegramId(customerTelegramId),
            message,
        })
    }

    /**
     * Send new order notification to business
     */
    async sendNewOrderNotification(businessTelegramId: TelegramIdLike, order: OrderDTO): Promise<boolean> {
        const message = `🔔 <b>Новый заказ!</b>

Заказ: #${order.id.slice(-6).toUpperCase()}
Сумма: ${this.formatMoney(order.total)}
Товаров: ${order.items.length}

Откройте панель управления для подтверждения.`

        return this.sendMessage({
            chatId: extractTelegramId(businessTelegramId),
            message,
        })
    }

    /**
     * Send new order available notification to couriers
     */
    async sendNewOrderAvailableNotification(
        courierTelegramId: TelegramIdLike,
        orderId: string,
        businessName: string,
        address: string,
        total: { amount: number; currency: string },
    ): Promise<boolean> {
        const message = `📦 <b>Новый заказ доступен!</b>

Заказ: #${orderId.slice(-6).toUpperCase()}
От: ${businessName}
Адрес: ${address}
Сумма: ${this.formatMoney(total)}

Откройте приложение, чтобы взять заказ.`

        return this.sendMessage({
            chatId: extractTelegramId(courierTelegramId),
            message,
        })
    }

    private formatOrderConfirmation(order: OrderDTO, businessName: string): string {
        const itemsList = order.items.map((item) => `• ${item.productName} x${item.quantity}`).join("\n")

        return `✅ <b>Заказ оформлен!</b>

Заказ: #${order.id.slice(-6).toUpperCase()}
От: ${businessName}

<b>Товары:</b>
${itemsList}

<b>Итого:</b> ${this.formatMoney(order.total)}

Статус: ${this.getStatusText(order.status)}

Мы уведомим вас об изменении статуса.`
    }

    private formatStatusChange(orderId: string, _previousStatus: OrderStatus, newStatus: OrderStatus): string {
        const statusEmoji = this.getStatusEmoji(newStatus)
        const statusText = this.getStatusText(newStatus)

        return `${statusEmoji} <b>Статус заказа изменён</b>

Заказ: #${orderId.slice(-6).toUpperCase()}
Статус: ${statusText}`
    }

    private formatMoney(money: { amount: number; currency: string }): string {
        return `${money.amount.toLocaleString("ru-RU")} ${money.currency}`
    }

    private getStatusText(status: OrderStatus): string {
        const statusMap: Record<OrderStatus, string> = {
            pending: "Ожидает подтверждения",
            accepted: "Принят",
            preparing: "Готовится",
            ready: "Готов к выдаче",
            picked_up: "У курьера",
            delivered: "Доставлен",
            cancelled: "Отменён",
        }
        return statusMap[status] ?? status
    }

    private getStatusEmoji(status: OrderStatus): string {
        const emojiMap: Record<OrderStatus, string> = {
            pending: "⏳",
            accepted: "✅",
            preparing: "👨‍🍳",
            ready: "📦",
            picked_up: "🚴",
            delivered: "✅",
            cancelled: "❌",
        }
        return emojiMap[status] ?? "📋"
    }
}
