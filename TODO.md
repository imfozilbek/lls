# TODO — technical debt

Known shortcuts. Fix an item when a real shop hits it or before the stage that needs it.

| # | Where | Debt | Why it waits | Fix when |
|---|-------|------|--------------|----------|
| 2 | `app` bundle | Customer JS is 91 KB gzip (+5 KB CSS) of the 100 KB budget | React alone is ~61 KB | Before adding any customer-side dependency; measure after each `vite build` |
| 4 | `worker/telegram/notifier.ts` | A failed notification is logged and the admins are alerted, but it is never retried | Customers also see the status in the app | If owners report missed order messages |
| 6 | `app/owner/OrdersTab.tsx` | The 20 s refresh of active orders reloads only the first page | Active orders rarely exceed 20 | A shop regularly has > 20 open orders |
| 8 | `worker` couriers | A courier removed by the owner keeps already assigned active orders; the owner must reassign them by hand | Rare in a small shop | If an owner reports a stuck order after removing a courier |
| 9 | `worker` showcase search | `LIKE '% word%'` scans every showcase product (no full-text index) | Hundreds of products stay far below the free D1 row limit | More than ~5 000 showcase products: move to an FTS5 table |
| 10 | `core` showcase | The showcase shows every showcase shop, without a district filter | The pilot is one district | A second district joins |
| 11 | `core` commission | Commission is only stored per order; no monthly report or settlement | Stage 1 stores data only | ROADMAP M8: one monthly per-shop report "to pay LLS" for the showcase commission and the service fee |
| 12 | Data location | Customer names and phones live in Cloudflare D1, outside Uzbekistan. Uzbek law on personal data (ЗРУ-547, art. 27¹) asks for data of Uzbek citizens to be stored on servers in Uzbekistan | The pilot is three friends' shops; not legal advice — needs a lawyer's view | Before a public launch or the first shop we do not know personally: ask a local lawyer; options are consent in the bot, or moving customer data to a server in Uzbekistan |
| 13 | Encryption key | If `TOKEN_ENC_KEY` is lost and no copy was saved, there is no self-serve way for an owner to enter the bot token again | The deploy guard and the saved-key secret make it unlikely | A shop's bot token changes (owner revoked it in BotFather): add "change bot token" in "Мой магазин" |
| 14 | Backups | R2 photos have no backup; D1 copies older than 7 days are manual and weekly | Owners can upload photos again | More than ~10 shops: a scheduled export to a private bucket |
| 15 | `worker/telegram/notifier.ts` | If the owner reassigns a courier within a split second, the first card's message id may be saved after the second one, and later edits of the card fail (logged and alerted) | Needs two taps faster than one Telegram call | An owner reports a courier card that stops updating |
| 16 | API lists | `GET /api/platform/shops` and `GET /api/owner/couriers` return a plain array, not `{ data, meta }` | Both are short (a person's shops, a shop's couriers) | Before any of them can grow past one screen |
| 17 | Money | Payments became transfer-only: the `cash_handovers` table, the `cash_courier_id` column and `PaymentMethod.CASH` stay only to read old rows | Additive schema rule; production had no cash rows yet | The release after the first production deploy: drop them in a new migration |
| 18 | Money | No expenses: the report shows money in, not profit | Waits for the pilots' answer on how they track spending | A pilot asks for expenses |
