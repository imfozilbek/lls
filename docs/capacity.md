# Capacity: Zumda on Cloudflare's free plan

Owner's decision (October 2026): no paid plans now; when the account's Workers requests stay
above 70 000 a day three days in a row, the owner decides on Workers Paid by hand (the sensor in
`imfozilbek/dream-infra` watches it, `TODO.md` #19). One Cloudflare account serves five projects
(Rida, Zumda, ilk•ish, Uyim, Grantchi), and the free limits are per account. This page shows
that Zumda fits its share on a busy day, line by line, and how each number was found.

## The day we plan for

| | |
|---|---|
| Active people | 1 000 (customers opening a shop or the showcase) |
| Orders | 300 (card transfers; cash orders cost the same or less) |
| Shops | 10 |
| Couriers | 15 |
| History | 6 months of orders (the numbers below do not grow with it) |

## Zumda's budget and the result

| Line | Account free limit | Zumda's share | Typical day | Heavy day | Fits |
|------|-------------------:|--------------:|------------:|----------:|------|
| Worker requests | 100 000 / day | 35 000 | ~32 700 | ~40 000 | typical yes; heavy: see "Levers" |
| D1 rows read | 5 000 000 / day | 1 500 000 | ~0.6 M | ~1.1 M | yes, also after 6 months |
| D1 rows written | 100 000 / day | 20 000 | ~15 000 | ~18 000 | yes |
| R2 storage | 10 GB | 4 GB | ~2 GB | ~2.3 GB | yes, and it stops growing |
| Cron triggers | 5 / account | 0-1 | 0 | 0 | yes |

"Typical": the owner keeps the orders screen open about 2 hours a day, a courier about 3 hours.
"Heavy": the owner keeps it open 6 hours.

## How the D1 rows were measured

`packages/worker/test/capacity.test.ts` builds one shop with **5 400 delivered orders (six months
of 30 a day)**, 10 open orders, 40 products, a courier and a customer. It then calls every screen
through the real Worker and D1, and counts `rows_read` and `rows_written` from D1's own `meta`. Each
screen has a limit in the test: a query that starts walking the history fails CI. Every new or
changed query also has an `EXPLAIN QUERY PLAN` check in `test/query-plans.test.ts`.

Rows read per request (authentication included):

| Request | Rows read | When |
|---------|----------:|------|
| Customer: `/api/me` | 3 | opening the app |
| Customer: the shop | 2 | opening the app |
| Customer: the menu, page 1 | 61 | opening the app (40 products) |
| Customer: an open order | 5 | every 30 s while the order screen is visible |
| Customer: my orders, page 1 | 83 | opening the list |
| Owner: orders version | 18 | every 20 s while the orders screen is visible |
| Owner: open orders | 61 | only when the version moved |
| Owner: finished, page 1 | 107 | opening the list |
| Owner: finished, page 20 | 867 | rare: OFFSET walks the pages before it |
| Owner: «Pul» today | 45 | opening «Pul» |
| Owner: «Pul» this month | 285 at day 5, ~1 700 at day 30 | opening «Pul» with the month |
| Courier: home | 166 (30 finished today, 11 open) | every 45 s while visible |
| Showcase: a search | 10 | after a pause in typing, from 3 letters |
| One order, placing to delivered (7 calls) | 91 read, 39 written | 300 a day |

What the measurement found and fixed on the way (before, on the same data):

| Request | Before | After | Fix |
|---------|-------:|------:|-----|
| «Pul» today | 10 862 | 45 | open transfers and couriers' cash by their own indexes (`0018`) |
| Finished orders, page 1 | 5 510 | 107 | no `COUNT(*)` over the history: one row more says whether more follow |
| My orders, page 1 | 5 494 | 83 | same |
| «O'tkazdim» (the screenshot) | 5 420 | 8 | the customer's refused transfers by a partial index (`0018`) |
| A status step, rows written | 9 | 3-4 | a save writes only the columns that changed (each index entry counts) |

## Worker requests, line by line

Photos, logos and the map no longer reach the Worker: R2 serves them at `media.zumda.shop` and
`map.zumda.shop`.

| Who | Calculation | Typical | Heavy |
|-----|-------------|--------:|------:|
| Customers opening a shop | 1 000 × 5 (me, shop, menu pages, my orders) | 5 000 | 5 000 |
| Customers who order | 300 × (6 actions + 20 order-screen checks) | 7 800 | 7 800 |
| Owners: version checks | 10 × 2 h × 180 / h (heavy: 6 h) | 3 600 | 10 800 |
| Owners: list reloads and actions | 300 orders × 6 changes + 300 × 6 actions | 3 600 | 3 600 |
| Couriers | 15 × 3 h × 80 / h + 300 × 2 actions | 4 200 | 4 200 |
| Bots (button presses, `/start`, contacts) | | 1 000 | 1 000 |
| Showcase searches | | 500 | 500 |
| Mini App crash reports (`POST /api/client-errors`) | one per kind of crash a session, at most 5; no preflight (text/plain) | < 50 | < 200 |
| CORS preflights (`OPTIONS`) | ~60% of the ~11 500 requests that are not repeated checks | 7 000 | 7 000 |
| **Total** | | **~32 700** | **~40 000** |

A repeated check of the same address is preflighted once per cache period (`Access-Control-Max-Age`
is one day; browsers cap it: Chromium at 2 hours). Every new address (another order, another
page) needs its own preflight, which is why they are a large share.

### Levers, in order, when requests near 35 000 a day

1. **The API on the app's own address** (`app.zumda.shop/api/*` routed to the Worker): no
   preflights at all, about −7 000. TODO #21.
2. **The owner's check every 30 s** instead of 20 s: about −3 600 on a heavy day.
3. **The courier's screen by a version**, like the owner's: fewer full reads and rows.

## D1 rows read, line by line

| What | Calculation | Typical | Heavy |
|------|-------------|--------:|------:|
| Customers opening a shop | 1 000 × ~97 (me, shop, menu 1.5 pages) | 97 000 | 97 000 |
| Orders placed to delivered | 300 × 91 | 27 000 | 27 000 |
| Order-screen checks | 300 × 20 × 5 | 30 000 | 30 000 |
| My orders | 300 × 83 | 25 000 | 25 000 |
| Owners: version checks | 3 600 × 18 (heavy 10 800) | 65 000 | 194 000 |
| Owners: list reloads | 1 800 × 61 | 110 000 | 110 000 |
| Owners: «Pul» and finished lists | 10 shops × 10 × (300 + 107) | 41 000 | 41 000 |
| Couriers' home | 3 600 × ~50 (20 deliveries spread over the day; heavy: 166) | 180 000 | 600 000 |
| Showcase, bots, admin | | 15 000 | 15 000 |
| **Total** | | **~0.6 M** | **~1.1 M** |

**After six months:** the same. Every polled or opened screen reads an index range of what is
open or of this day or month, never the history; the test above runs on six months of it.

«Qo'llanma» in «Platforma» is not in the table: an admin opens it once in months. It walks the
people, not their orders (a row or two each: about 2 000 for a district of 1 000 customers), and
a whole send writes one row a person into `guide_sends`.
Reports over a period (the CSV export, «Pul» this month) read that period only.

## D1 rows written, line by line

D1 counts every index entry written as a row: an order row has over a dozen indexes.

| What | Calculation | Typical | Heavy |
|------|-------------|--------:|------:|
| Orders | 300 × 39 | 11 700 | 11 700 |
| Customers (new ones, phone shares) | ~50 × 6 | 300 | 600 |
| Products saved (row + search words + indexes) | 10 shops × 10 × ~15 | 1 500 | 3 000 |
| «Ro'yxat bilan qo'shish»: a new shop's list, once (50 × ~15; reads: the shop's names, one covering index) | rare, at most 5 a minute | 0 | 750 |
| Couriers' shifts, network offers | | 500 | 1 000 |
| Bot message ids, alerts, sessions | 300 × 2 × 2 + ~200 | 1 400 | 1 700 |
| **Total** | | **~15 000** | **~18 000** |

## R2 storage

| What | Size | Grows? |
|------|-----:|--------|
| The map: the current file and the one before (`map-data.mjs` removes the rest) | ~550 MB | no |
| Fonts and icons of the map | a few MB | no |
| Product photos (10 shops × 100 × ~80 KB) and logos, posters | ~100 MB | with the catalogs only |
| Transfer screenshots (`zumda-receipts`): 300 a day × ~150 KB (1 280 px) × 30 days | ~1.35 GB | no: R2 deletes each after 30 days |
| **Total** | **~2 GB** | |

R2 operations: Class A (writes, 1 M a month free) are ~10 000 screenshots and photos a month plus
one map upload (~110 objects). Class B (reads, 10 M a month free): photos are cached by Cloudflare
at `media.zumda.shop`; the map's byte ranges are cached when the Cache Rule could be set (the
deploy warns when its token lacks Zone > Cache Rules: Edit), else ~40 reads a map opening, ~1 M a
month at 800 openings a day.

## Mini App crashes

Each kind of crash is sent once a session (at most 5 a session), as a plain-text request with no
CORS preflight, and the Worker keeps 10 a minute per address. A report reads nothing from D1 and
writes one `alert_log` row when it alerts (once per 10 minutes per kind). Workers Logs keep 20%
of requests (`head_sampling_rate`), so a log line may be missing; the admins' alert is the one
that is always sent.

## Cron

None. Timed checks (an unclaimed network order) run on the next event; the receipts' 30 days are
an R2 lifecycle rule; the monthly map is a GitHub workflow.

## Checking it on production

Cloudflare's GraphQL analytics give the day's Worker requests per script and D1 rows read and
written per database. Compare them with the table above one day after each deploy that changes a
screen's queries or polling, and after the pilots' first busy week.
