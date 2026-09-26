/** The verified Telegram user from Mini App initData or a bot update. */
export interface TelegramUser {
    id: number
    firstName: string
    lastName?: string
    username?: string
    languageCode?: string
}

const MAX_NAME = 100

export function displayNameOf(user: TelegramUser): string {
    const fullName = [user.firstName, user.lastName]
        .filter((part): part is string => Boolean(part?.trim()))
        .map((part) => part.trim())
        .join(" ")
    const name = fullName || user.username?.trim() || `Telegram ${user.id}`
    return name.slice(0, MAX_NAME)
}
