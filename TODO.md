# TODO — technical debt

Known shortcuts. Fix an item when a real shop hits it or before the stage that needs it.

| # | Where | Debt | Why it waits | Fix when |
|---|-------|------|--------------|----------|
| 1 | `app/owner/SettingsTab.tsx` | Working hours: one open/close time for all chosen days. A shop with different hours per day gets them flattened on save | Small shops in the pilot keep one schedule | A shop asks for per-day hours |
| 2 | `app` bundle | Customer JS + CSS is 92 KB gzip of the 100 KB budget | React alone is ~61 KB | Before adding any customer-side dependency; measure after each `vite build` |
| 3 | `worker/routes/webhook.routes.ts` | If `setWebhook` fails while an admin approves a shop, the shop is `active` but its bot is not connected; there is no "reconnect" button | Rare; the admin can re-run it by hand | Before onboarding shops we do not know personally |
| 4 | `worker/telegram/notifier.ts` | A failed notification (Telegram down, bot blocked) is only logged, never retried | Customers also see the status in the app | If owners report missed order messages |
| 5 | End-to-end test | The Playwright run of the three demo shops against `wrangler dev` lives outside the repo: CI has no Playwright yet | Adds ~1 min and a dependency to CI | Before shops beyond the three friends go live |
| 6 | `app/owner/OrdersTab.tsx` | The 20 s refresh of active orders reloads only the first page | Active orders rarely exceed 20 | A shop regularly has > 20 open orders |
| 7 | `.github/scripts/deploy.sh` | `TOKEN_ENC_KEY` is generated in CI and exists only in Cloudflare (secrets cannot be read back). If it is deleted, stored bot tokens cannot be decrypted and shops must reconnect | One less manual step for the first launch | Before the pilot has more than a few shops: take the key from a GitHub secret the owner also keeps offline |
| 8 | `worker` couriers | A courier removed by the owner keeps already assigned active orders; the owner must reassign them by hand | Rare in a small shop | If an owner reports a stuck order after removing a courier |
| 9 | `core` marketplace | `Business.marketplace` and the `marketplace` channel exist only as data; nothing creates marketplace orders yet | Stage 2 | When the district marketplace is built |
