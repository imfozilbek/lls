import { Module } from "@nestjs/common"

import { TelegramNotificationService } from "./telegram-notification.service.js"

@Module({
    providers: [TelegramNotificationService],
    exports: [TelegramNotificationService],
})
export class NotificationsModule {}
