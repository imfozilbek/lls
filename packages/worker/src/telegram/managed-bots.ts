import { BusinessStatus } from "@zumda/core"

import { Notifier } from "./notifier.js"

import type { ManagedBotUpdate } from "./updates.js"
import type { Services } from "../services.js"

/** Telegram usernames: 5 to 32 of `a-z 0-9 _`, a letter first, and a bot's ends in `bot`. */
const USERNAME_MAX = 32
const BOT_SUFFIX = "_bot"
const FALLBACK_BASE = "dokon"

/** Uzbek and Russian Cyrillic to the Latin of a username (owners type names in either). */
const CYRILLIC: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    ғ: "g",
    д: "d",
    е: "e",
    ё: "yo",
    ж: "j",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    қ: "q",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ў: "o",
    ф: "f",
    х: "x",
    ҳ: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sh",
    ъ: "",
    ы: "i",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
}

/**
 * The @username suggested for a shop's new bot: `Maqsudbek Burger` → `maqsudbek_burger_bot`.
 * Telegram shows it in its own window, where the owner can change it if it is taken.
 */
export function suggestBotUsername(shopName: string): string {
    const latin = [...shopName.toLowerCase()].map((char) => CYRILLIC[char] ?? char).join("")
    const words = latin
        .replace(/['ʻʼ‘’`]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^[_0-9]+|_+$/g, "")
    const base = (words || FALLBACK_BASE)
        .slice(0, USERNAME_MAX - BOT_SUFFIX.length)
        .replace(/_+$/, "")
    return base.endsWith("bot") ? base : `${base}${BOT_SUFFIX}`
}

/** The link that opens Telegram's «new bot» window managed by ours (older Telegram apps). */
export function newBotLink(managerUsername: string, username: string, name: string): string {
    const query = new URLSearchParams({ name })
    return `https://t.me/newbot/${managerUsername}/${username}?${query.toString()}`
}

/** A positive 32-bit id for `request_managed_bot.request_id`. */
export function randomRequestId(): number {
    const [value = 1] = crypto.getRandomValues(new Uint32Array(1))
    return (value % 0x7fffffff) + 1
}

/**
 * `managed_bot` in the Zumda Business bot: a bot was created for us to manage, or its token or its owner
 * changed. The token is fetched here and goes straight to the encrypted store.
 */
export async function handleManagedBot(
    services: Services,
    update: ManagedBotUpdate,
    workerOrigin: string,
): Promise<void> {
    const token = await services.telegram.getManagedBotToken(
        services.env.BUSINESS_BOT_TOKEN,
        update.bot.id,
    )
    const change = await services.useCases.managedBotChanged.execute({
        bot: { id: update.bot.id, username: update.bot.username },
        ownerTelegramId: update.user.id,
        token,
    })
    const notifier = new Notifier(services)
    if (change.kind === "created") {
        await notifier.managedBotCreated(update.user.id, change.botUsername)
        return
    }
    // A live shop answers through the new token at once; a pending one connects on approval.
    if (change.shop.status === BusinessStatus.ACTIVE) {
        await notifier.connectShopBot(change.shop, workerOrigin)
    }
    if (change.kind === "ownerChanged") {
        await notifier.managedBotOwnerChanged(change.shop, change.newOwnerTelegramId)
    }
}
