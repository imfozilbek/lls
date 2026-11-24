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
| Worker requests | 100 000 / day | 35 000 | ~33 900 | ~41 500 | typical yes; heavy: see "Levers" |
| D1 rows read | 5 000 000 / day | 1 500 000 | ~0.6 M | ~1.1 M | yes, also after 6 months |
| D1 rows written | 100 000 / day | 20 000 | ~17 400 | ~21 900 | typical yes; heavy ~10% over the share (the account has room: see below) |
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
| Customer: the shop | 2 (3 when the shop has no number: the owner's phone is read) | opening the app |
| Customer: the menu, page 1 | 61 | opening the app (40 products) |
| Customer: an open order | 5 | every 30 s while the order screen is visible |
| Customer: my orders, page 1 | 83 | opening the list |
| Owner: orders version | 18 | every 20 s while the orders screen is visible |
| Owner: open orders | 61 | only when the version moved |
| Owner: finished, page 1 | 107 | opening the list |
| Owner: finished, page 20 | 867 | rare: OFFSET walks the pages before it |
| Owner: «Pul» today | 45 | opening «Pul» |
| Owner: «Pul» this month | 285 at day 5, ~1 700 at day 30 | opening «Pul» with the month |
| Courier: home | 166 (30 finished today, 11 open; +1 per shop of the day without its own number) | every 45 s while visible |
| Showcase: a search | 10 | after a pause in typing; two letters match a whole word only, a prefix from three |
| One order, placing to delivered (7 calls: «Yig'ishni boshlash» is a step of its own; the customer's live message reads its id on each step and writes it 4 times) | 115 read, 46 written (120 and 49 when it came by a post or an ad link: the visit read, the link's two counters) | 300 a day |
| Owner: «Telegram kanal» | 2 (and one Telegram call for the subscribers) | opening it |
| Owner: the channel's posts, or the ad links, page 1 | 23 | opening the list |
| A pressed post or ad link (`/start s_<code>`) | 4 read, 2 written (the link's count, the visit) | each press |
| A post the owner made in Telegram (`channel_post`) | 42 read (the shop's names for the guess: one row a product, 40 here), 5 written (the post's row and its indexes) | each post |
| «Eski postlarni ham qo'shish», one press | 63 read, 51 written (a page of the channel, the shop's names once, ten posts, where it stopped) | once a channel: ~30 presses for 300 posts |
| A customer's message to the shop's bot with a support group (goal 21) | 3 read (the shop, the group, the topic); the first one 7 read, 2 written (the topic, the card's last order: one row of an index range) | each message: ~10 shops × 20 a day |
| The shop's answer in a customer's topic | 3 read (the shop, the group, whose topic) | each answer: ~10 shops × 20 a day |
| The storefront (`/api/shop`) | +1 (whether the shop has a support group) | each opening |

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
| Owners: list reloads and actions | 300 orders × 7 changes + 300 × 7 actions | 4 200 | 4 200 |
| Couriers | 15 × 3 h × 80 / h + 300 × 2 actions | 4 200 | 4 200 |
| Bots (button presses, `/start`, contacts; pressed posts and ad links ~200, heavy 500) | | 1 200 | 1 500 |
| Showcase searches | | 500 | 500 |
| Mini App crash reports (`POST /api/client-errors`) | one per kind of crash a session, at most 5; no preflight (text/plain) | < 50 | < 200 |
| CORS preflights (`OPTIONS`) | ~60% of the ~12 100 requests that are not repeated checks | 7 400 | 7 400 |
| **Total** | | **~33 900** | **~41 500** |

A repeated check of the same address is preflighted once per cache period (`Access-Control-Max-Age`
is one day; browsers cap it: Chromium at 2 hours). Every new address (another order, another
page) needs its own preflight, which is why they are a large share.

The delivery price (November 2026) adds no request and no read: one more column on a settings save
and on an order, in no index.

The ticks while collecting (November 2026) are kept on the owner's phone: no request and no row.
On the server they would add about 900 requests and 300 preflights a day, and 900 rows written.

### Levers, in order, when requests near 35 000 a day

1. **The API on the app's own address** (`app.zumda.shop/api/*` routed to the Worker): no
   preflights at all, about −7 000. TODO #21.
2. **The owner's check every 30 s** instead of 20 s: about −3 600 on a heavy day.
3. **The courier's screen by a version**, like the owner's: fewer full reads and rows.

## D1 rows read, line by line

| What | Calculation | Typical | Heavy |
|------|-------------|--------:|------:|
| Customers opening a shop | 1 000 × ~97 (me, shop, menu 1.5 pages) | 97 000 | 97 000 |
| Orders placed to delivered | 300 × 115 | 34 500 | 34 500 |
| Order-screen checks | 300 × 20 × 5 | 30 000 | 30 000 |
| My orders | 300 × 83 | 25 000 | 25 000 |
| Owners: version checks | 3 600 × 18 (heavy 10 800) | 65 000 | 194 000 |
| Owners: list reloads | 2 100 × 61 | 128 000 | 128 000 |
| Owners: «Pul» and finished lists | 10 shops × 10 × (300 + 107) | 41 000 | 41 000 |
| Couriers' home | 3 600 × ~50 (20 deliveries spread over the day; heavy: 166) | 180 000 | 600 000 |
| Showcase, bots, admin | | 15 000 | 15 000 |
| **Total** | | **~0.6 M** | **~1.1 M** |

**After six months:** the same. Every polled or opened screen reads an index range of what is
open or of this day or month, never the history; the test above runs on six months of it.

«Qo'llanma» in «Platforma» is not in the table: an admin opens it once in months. It walks the
people, not their orders (a row or two each: about 2 000 for a district of 1 000 customers), and
a whole send writes one row a person into `guide_sends`. «Raqam so'rash» on «Bizneslar» is the
same kind: it walks the live shops and their couriers (a row or two each, never an order) when
an admin opens «Bizneslar», and an ask writes one row a person into `phone_asks`.
Reports over a period (the CSV export, «Pul» this month) read that period only.

## D1 rows written, line by line

D1 counts every index entry written as a row: an order row has over a dozen indexes.

| What | Calculation | Typical | Heavy |
|------|-------------|--------:|------:|
| Orders (accept and «Yig'ishni boshlash» are two steps since November 2026; the measured 46 has the bots' message ids: the owner's and the courier's card once each, the customer's live message 4 times: placed, accepted, on the way, delivered) | 300 × 46 | 13 800 | 13 800 |
| Customers (new ones, phone shares) | ~50 × 6 | 300 | 600 |
| Products saved (row + search words + indexes) | 10 shops × 10 × ~15 | 1 500 | 3 000 |
| «Ro'yxat bilan qo'shish»: a new shop's list, once (50 × ~15; reads: the shop's names, one covering index) | rare, at most 5 a minute | 0 | 750 |
| Couriers' shifts, network offers | | 500 | 1 000 |
| Counted stock: a placed order with a counted product, a cancel giving it back (one product row each; `stock` is in no index) | ~50 orders × ~1.5 | 75 | 300 |
| «Yo'q»: the order row (sums, `refund_owed` in its partial index), the line, the product stopped today | ~10 a day × ~10 (heavy ~20) | 100 | 200 |
| A dispatcher's «Jo'natdim» and notes (one order row each: only the changed columns, `updated_at` re-indexed) | ~20 orders × ~3 × ~4 | 240 | 500 |
| Alerts, sessions (the orders' message ids are in the line above, measured) | ~200 | 200 | 200 |
| Pressed posts and ad links (the link's count and the visit; a post: its row once, a price edit its key) | ~200 presses × 2 (heavy 500) | 400 | 1 000 |
| Orders that came by a post or an ad link (the link's order and sale counters, measured +3) | ~100 × 3 (heavy 150) | 300 | 450 |
| Posts the owners made in Telegram (each written once with its indexes, measured 5) | 10 shops × 5 posts × 5 | 250 | 500 |
| «Eski postlar»: a channel's past, once (about 5 a post; a heavy day: one channel of 300 posts) | once a channel | 0 | 1 500 |
| Support topics: a customer's first message to a shop (the topic's row and its index; no message is stored) | ~30 new customers × 2 (heavy 100) | 60 | 200 |
| **Total** | | **~17 710** | **~24 100** |

The heavy day passes the share (~24 100 of 20 000, the account's limit is 100 000): the
customer's live message added 4 rows an order (+1 200 a day), the shop's channel ~1 500 more
(November 2026: presses and the orders they bring), and a channel's past read in one day ~1 500
(once a channel: the owner may read it over several days, where it stopped is kept). The presses are a guess until a real channel
runs; if they stay high, the visit's row is the lever (a repeat press by the same person adds no
open but renews the visit: one row; a press within the same hour could skip it). The account's
sensor in `imfozilbek/dream-infra` watches the real total; measure the writes again before adding
more to an order's way.

## R2 storage

| What | Size | Grows? |
|------|-----:|--------|
| The map: the current file and the one before (`map-data.mjs` removes the rest) | ~550 MB | no |
| Fonts and icons of the map | a few MB | no |
| Product photos (10 shops × 100 × up to 3 × ~80 KB) and logos, posters | ~100-250 MB | with the catalogs only |
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
