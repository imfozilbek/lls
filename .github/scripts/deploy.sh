#!/usr/bin/env bash
# Deploys Zumda to Cloudflare. Idempotent: safe to run on every push to main.
#
# Creates what is missing (D1, R2, Pages project, the addresses api.zumda.shop and app.zumda.shop),
# applies D1 migrations, deploys the Worker with its secrets, deploys the Mini App to Pages and
# connects the three Zumda bots: Shop (customers), Business (owners, admins) and Kuryer.
#
# Needs env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, PLATFORM_BOT_TOKEN, PLATFORM_ADMIN_IDS,
# COURIER_BOT_TOKEN, BUSINESS_BOT_TOKEN.
# Optional: TOKEN_ENC_KEY, a saved copy of the encryption key, used only when the Worker has none.
set -euo pipefail
# Temp files (the Worker secrets file) are readable by this user only.
umask 077

readonly WORKER="zumda-worker"
readonly DATABASE="zumda"
readonly BUCKET="zumda-media"
readonly PAGES_PROJECT="zumda-app"
readonly DB_PLACEHOLDER="00000000-0000-0000-0000-000000000000"
# Zumda's own addresses. The Worker has no workers.dev address (wrangler.jsonc).
readonly DOMAIN="zumda.shop"
readonly API_HOST="api.${DOMAIN}"
readonly APP_HOST="app.${DOMAIN}"
readonly WORKER_URL="https://${API_HOST}"
readonly APP_ORIGIN="https://${APP_HOST}"
readonly CF_ROOT="https://api.cloudflare.com/client/v4"
readonly CF_API="${CF_ROOT}/accounts/${CLOUDFLARE_ACCOUNT_ID}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
readonly ROOT
readonly WORKER_DIR="${ROOT}/packages/worker"
readonly APP_DIR="${ROOT}/packages/app"

log() { printf '\n==> %s\n' "$*"; }
fail() { printf '::error::%s\n' "$*"; exit 1; }
wrangler() { (cd "$WORKER_DIR" && bunx wrangler "$@"); }

# GET/POST/PUT to the Cloudflare API: account paths (/d1/...) or zone paths (/zones/...).
# Prints the body; returns non-zero on HTTP errors.
cf() {
    local method="$1" path="$2" body="${3:-}" base="$CF_API"
    if [[ "$path" == /zones* ]]; then base="$CF_ROOT"; fi
    local args=(-sS -X "$method" -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
        -H "Content-Type: application/json" -w '\n%{http_code}')
    if [[ -n "$body" ]]; then args+=(--data "$body"); fi
    curl "${args[@]}" "${base}${path}"
}

# Splits "body\nstatus" from cf(): sets CF_BODY and CF_STATUS.
cf_call() {
    local response
    response="$(cf "$@")"
    CF_STATUS="${response##*$'\n'}"
    CF_BODY="${response%$'\n'*}"
}

ensure_d1() {
    log "D1 database '${DATABASE}'"
    cf_call GET "/d1/database?name=${DATABASE}"
    [[ "$CF_STATUS" == 200 ]] || fail "Cannot list D1 databases (HTTP ${CF_STATUS}). Check the API token has D1 Edit."
    DATABASE_ID="$(jq -r --arg n "$DATABASE" '.result[] | select(.name == $n) | .uuid' <<<"$CF_BODY" | head -n1)"
    if [[ -z "$DATABASE_ID" ]]; then
        cf_call POST "/d1/database" "$(jq -n --arg n "$DATABASE" '{name: $n}')"
        [[ "$CF_STATUS" == 200 ]] || fail "Cannot create D1 database (HTTP ${CF_STATUS})."
        DATABASE_ID="$(jq -r '.result.uuid' <<<"$CF_BODY")"
        echo "created ${DATABASE_ID}"
    else
        echo "exists ${DATABASE_ID}"
    fi
    # Only the CI checkout is changed; the repo keeps the placeholder for local dev.
    sed -i "s/${DB_PLACEHOLDER}/${DATABASE_ID}/" "${WORKER_DIR}/wrangler.jsonc"
}

ensure_r2() {
    log "R2 bucket '${BUCKET}'"
    cf_call GET "/r2/buckets/${BUCKET}"
    if [[ "$CF_STATUS" == 200 ]]; then echo "exists"; return; fi
    [[ "$CF_STATUS" == 404 ]] || fail "Cannot read R2 (HTTP ${CF_STATUS}). Is R2 enabled for the account?"
    cf_call POST "/r2/buckets" "$(jq -n --arg n "$BUCKET" '{name: $n}')"
    [[ "$CF_STATUS" == 200 ]] || fail "Cannot create R2 bucket (HTTP ${CF_STATUS})."
    echo "created"
}

ensure_pages() {
    log "Pages project '${PAGES_PROJECT}'"
    cf_call GET "/pages/projects/${PAGES_PROJECT}"
    if [[ "$CF_STATUS" == 404 ]]; then
        cf_call POST "/pages/projects" \
            "$(jq -n --arg n "$PAGES_PROJECT" '{name: $n, production_branch: "main"}')"
        [[ "$CF_STATUS" == 200 ]] || fail "Cannot create Pages project (HTTP ${CF_STATUS})."
    elif [[ "$CF_STATUS" != 200 ]]; then
        fail "Cannot read Pages project (HTTP ${CF_STATUS}). Check the API token has Pages Edit."
    fi
    PAGES_HOST="$(jq -r '.result.subdomain' <<<"$CF_BODY")"
    echo "$PAGES_HOST"
}

# app.zumda.shop: the Pages custom domain plus its DNS record. A domain added through the API gets
# no DNS record by itself.
ensure_app_domain() {
    log "Mini App address '${APP_HOST}'"
    cf_call GET "/pages/projects/${PAGES_PROJECT}/domains/${APP_HOST}"
    if [[ "$CF_STATUS" == 404 ]]; then
        cf_call POST "/pages/projects/${PAGES_PROJECT}/domains" "$(jq -n --arg n "$APP_HOST" '{name: $n}')"
        [[ "$CF_STATUS" == 2?? ]] || fail "Cannot add ${APP_HOST} to Pages (HTTP ${CF_STATUS})."
        echo "added"
    elif [[ "$CF_STATUS" == 200 ]]; then
        echo "exists, $(jq -r '.result.status' <<<"$CF_BODY")"
    else
        fail "Cannot read the Pages domains (HTTP ${CF_STATUS}). Check the API token has Pages Edit."
    fi

    cf_call GET "/zones?name=${DOMAIN}"
    [[ "$CF_STATUS" == 200 ]] || fail "Cannot read the zone ${DOMAIN} (HTTP ${CF_STATUS}). Check the API token has Zone Read."
    local zone
    zone="$(jq -r '.result[0].id // empty' <<<"$CF_BODY")"
    [[ -n "$zone" ]] || fail "The zone ${DOMAIN} is not in this Cloudflare account."
    cf_call GET "/zones/${zone}/dns_records?name=${APP_HOST}"
    [[ "$CF_STATUS" == 200 ]] || fail "Cannot read DNS records (HTTP ${CF_STATUS}). Check the API token has DNS Edit."
    if [[ "$(jq '.result | length' <<<"$CF_BODY")" == 0 ]]; then
        cf_call POST "/zones/${zone}/dns_records" "$(jq -n --arg n "$APP_HOST" --arg c "$PAGES_HOST" \
            '{type: "CNAME", name: $n, content: $c, proxied: true}')"
        [[ "$CF_STATUS" == 2?? ]] || fail "Cannot create the DNS record ${APP_HOST} (HTTP ${CF_STATUS})."
        echo "DNS record created: ${APP_HOST} → ${PAGES_HOST}"
    else
        echo "DNS record exists"
    fi
}

# TOKEN_ENC_KEY encrypts shop bot tokens. It is set ONCE and never replaced:
# a new key would make every stored token unreadable.
needs_encryption_key() {
    cf_call GET "/workers/scripts/${WORKER}/secrets"
    if [[ "$CF_STATUS" == 404 ]]; then return 0; fi
    [[ "$CF_STATUS" == 200 ]] || fail "Cannot read Worker secrets (HTTP ${CF_STATUS}). Refusing to guess."
    ! jq -e '.result[] | select(.name == "TOKEN_ENC_KEY")' <<<"$CF_BODY" >/dev/null
}

shop_count() {
    wrangler d1 execute "$DATABASE" --remote --json \
        --command "SELECT COUNT(*) AS n FROM businesses" | jq -r '.[0].results[0].n'
}

# Sets ENC_KEY for a Worker that has none: the saved copy if given, a new one on a fresh
# database. Stops the deploy when shops exist and no saved copy is given: a new key would
# silently break every shop bot.
encryption_key() {
    if [[ -n "${TOKEN_ENC_KEY:-}" ]]; then
        [[ "$(printf '%s' "$TOKEN_ENC_KEY" | base64 -d 2>/dev/null | wc -c)" == 32 ]] \
            || fail "The TOKEN_ENC_KEY secret is not 32 bytes in base64 (openssl rand -base64 32)."
        echo "using the saved TOKEN_ENC_KEY"
        ENC_KEY="$TOKEN_ENC_KEY"
        return
    fi
    local shops
    shops="$(shop_count)"
    [[ "$shops" =~ ^[0-9]+$ ]] || fail "Cannot count shops in D1. Refusing to guess."
    if ((shops > 0)); then
        fail "The Worker lost TOKEN_ENC_KEY, but D1 has ${shops} shop(s) with encrypted bot tokens. Put the saved key into the GitHub secret TOKEN_ENC_KEY and run the deploy again (SECURITY.md, 'Encryption key')."
    fi
    echo "generating TOKEN_ENC_KEY (first deploy)"
    ENC_KEY="$(openssl rand -base64 32)"
}

# A webhook secret derived from a bot token: `webhook_secret <label> <token>`.
webhook_secret() {
    printf '%s' "$1" | openssl dgst -sha256 -hmac "$2" -r | cut -d' ' -f1
}

deploy_worker() {
    log "Migrations"
    wrangler d1 migrations apply "$DATABASE" --remote

    log "Worker"
    # Derived, not stored: the same bot token always gives the same webhook secret.
    PLATFORM_WEBHOOK_SECRET="$(webhook_secret zumda-platform-webhook "$PLATFORM_BOT_TOKEN")"
    COURIER_WEBHOOK_SECRET="$(webhook_secret zumda-courier-webhook "$COURIER_BOT_TOKEN")"
    BUSINESS_WEBHOOK_SECRET="$(webhook_secret zumda-business-webhook "$BUSINESS_BOT_TOKEN")"
    echo "::add-mask::${PLATFORM_WEBHOOK_SECRET}"
    echo "::add-mask::${COURIER_WEBHOOK_SECRET}"
    echo "::add-mask::${BUSINESS_WEBHOOK_SECRET}"

    SECRETS_FILE="$(mktemp)"
    chmod 600 "$SECRETS_FILE"
    trap 'rm -f "$SECRETS_FILE" "${SECRETS_FILE}.new"' EXIT
    local secrets_file="$SECRETS_FILE"
    jq -n --arg bot "$PLATFORM_BOT_TOKEN" --arg admins "$PLATFORM_ADMIN_IDS" \
        --arg hook "$PLATFORM_WEBHOOK_SECRET" --arg courier "$COURIER_BOT_TOKEN" \
        --arg courier_hook "$COURIER_WEBHOOK_SECRET" --arg business "$BUSINESS_BOT_TOKEN" \
        --arg business_hook "$BUSINESS_WEBHOOK_SECRET" \
        '{PLATFORM_BOT_TOKEN: $bot, PLATFORM_ADMIN_IDS: $admins, PLATFORM_WEBHOOK_SECRET: $hook,
          COURIER_BOT_TOKEN: $courier, COURIER_WEBHOOK_SECRET: $courier_hook,
          BUSINESS_BOT_TOKEN: $business, BUSINESS_WEBHOOK_SECRET: $business_hook}' \
        >"$secrets_file"
    if needs_encryption_key; then
        encryption_key
        echo "::add-mask::${ENC_KEY}"
        jq --arg key "$ENC_KEY" '. + {TOKEN_ENC_KEY: $key}' "$secrets_file" >"${secrets_file}.new"
        mv "${secrets_file}.new" "$secrets_file"
    fi
    # The custom domain gets its DNS record and certificate from Cloudflare.
    wrangler deploy --domain "$API_HOST" --var "APP_ORIGIN:${APP_ORIGIN}" \
        --secrets-file "$secrets_file"
}

deploy_app() {
    log "Mini App"
    (cd "$APP_DIR" && VITE_API_URL="$WORKER_URL" bun run build)
    wrangler pages deploy "${APP_DIR}/dist" --project-name "$PAGES_PROJECT" --branch main \
        --commit-dirty=true
}

# `telegram <token> <method> [curl args]`
telegram() {
    local token="$1" method="$2"
    shift 2
    local result
    result="$(curl -sS "https://api.telegram.org/bot${token}/${method}" "$@")"
    jq -e '.ok' <<<"$result" >/dev/null || fail "Telegram ${method} failed: $(jq -r '.description' <<<"$result")"
}

# The empty-chat description (512 max) and the profile line (120 max) of the Zumda bots: Uzbek,
# no em dash. Zumda serves shops, eateries and services.
read -r -d '' PLATFORM_DESCRIPTION <<'TEXT' || true
Zumda: tumaningizdagi do'konlar, oshxonalar va xizmatlar bir joyda.

🔎 Kerakli narsani qidiring
🛒 Buyurtma bering
🚚 Kuryer eshigingizgacha olib keladi
TEXT
readonly PLATFORM_DESCRIPTION
readonly PLATFORM_SHORT_DESCRIPTION="Tumaningizdagi do'konlar, oshxonalar va xizmatlar bir joyda. Buyurtma bering, eshigingizgacha yetkazamiz."
read -r -d '' COURIER_DESCRIPTION <<'TEXT' || true
Zumda kuryer boti.

📦 Do'kon, oshxona va xizmatlar buyurtmalarini oling
✅ «Oldim» va «Yetkazdim» tugmalari
💳 Pul olmaysiz: mijoz oldindan to'lagan

Kuryer bo'lish uchun biznes yuborgan havolani oching.
TEXT
readonly COURIER_DESCRIPTION
read -r -d '' BUSINESS_DESCRIPTION <<'TEXT' || true
Zumda Business: do'kon, oshxona va xizmatlar uchun.

🤖 O'z buyurtma botingizni bir tugma bilan yarating: token kerak emas
📋 Menyu, buyurtmalar, pul va kuryerlar bir joyda
🏪 Bir nechta biznesingiz bo'lsa ham, hammasi shu yerda
TEXT
readonly BUSINESS_DESCRIPTION
readonly BUSINESS_SHORT_DESCRIPTION="Biznesingiz uchun o'z buyurtma boti: yarating va boshqaring. Menyu, buyurtmalar, pul, kuryerlar."
readonly COURIER_SHORT_DESCRIPTION="Zumda kuryerlari uchun: do'kon, oshxona va xizmatlar buyurtmalarini yetkazing."

# The bots' names, the owner's choice (October 2026).
readonly PLATFORM_NAME="Zumda | Shop"
readonly BUSINESS_NAME="Zumda | Business"
readonly COURIER_NAME="Zumda | Kuryer"

# `set_profile <token> <name> <description> <short description>`: setMyName only when it differs
# (Telegram limits how often a name may change).
set_profile() {
    local current
    current="$(curl -sS "https://api.telegram.org/bot${1}/getMyName" | jq -r '.result.name // empty')"
    if [[ "$current" != "$2" ]]; then
        telegram "$1" setMyName --data-urlencode "name=$2"
    fi
    set_descriptions "$1" "$3" "$4"
}

# `set_descriptions <token> <description> <short description>`
set_descriptions() {
    telegram "$1" setMyDescription --data-urlencode "description=$2"
    telegram "$1" setMyShortDescription --data-urlencode "short_description=$3"
}

connect_platform_bot() {
    log "Platform bot"
    telegram "$PLATFORM_BOT_TOKEN" setWebhook \
        --data-urlencode "url=${WORKER_URL}/tg/platform" \
        --data-urlencode "secret_token=${PLATFORM_WEBHOOK_SECRET}" \
        --data-urlencode 'allowed_updates=["message","callback_query"]'
    telegram "$PLATFORM_BOT_TOKEN" setChatMenuButton --data-urlencode "menu_button=$(jq -nc --arg url "${APP_ORIGIN}/?mode=market" \
        '{type: "web_app", text: "Zumda", web_app: {url: $url}}')"
    set_profile "$PLATFORM_BOT_TOKEN" "$PLATFORM_NAME" "$PLATFORM_DESCRIPTION" "$PLATFORM_SHORT_DESCRIPTION"
    echo "webhook, menu button, name and descriptions set"
}

# Zumda Business: owners' «Mening bizneslarim», applications, admins' commands. It creates and
# manages the shops' bots, so it hears `managed_bot`.
connect_business_bot() {
    log "Business bot"
    telegram "$BUSINESS_BOT_TOKEN" setWebhook \
        --data-urlencode "url=${WORKER_URL}/tg/business" \
        --data-urlencode "secret_token=${BUSINESS_WEBHOOK_SECRET}" \
        --data-urlencode 'allowed_updates=["message","callback_query","managed_bot"]'
    telegram "$BUSINESS_BOT_TOKEN" setChatMenuButton --data-urlencode "menu_button=$(jq -nc --arg url "${APP_ORIGIN}/?mode=business" \
        '{type: "web_app", text: "Bizneslarim", web_app: {url: $url}}')"
    set_profile "$BUSINESS_BOT_TOKEN" "$BUSINESS_NAME" "$BUSINESS_DESCRIPTION" "$BUSINESS_SHORT_DESCRIPTION"
    echo "webhook, menu button, name and descriptions set"
}

# The Zumda courier bot: one bot for every courier; its menu button opens the courier screen.
connect_courier_bot() {
    log "Courier bot"
    telegram "$COURIER_BOT_TOKEN" setWebhook \
        --data-urlencode "url=${WORKER_URL}/tg/courier" \
        --data-urlencode "secret_token=${COURIER_WEBHOOK_SECRET}" \
        --data-urlencode 'allowed_updates=["message","callback_query"]'
    telegram "$COURIER_BOT_TOKEN" setChatMenuButton --data-urlencode "menu_button=$(jq -nc --arg url "${APP_ORIGIN}/?mode=courier" \
        '{type: "web_app", text: "Kuryer", web_app: {url: $url}}')"
    set_profile "$COURIER_BOT_TOKEN" "$COURIER_NAME" "$COURIER_DESCRIPTION" "$COURIER_SHORT_DESCRIPTION"
    echo "webhook, menu button, name and descriptions set"
}

# Waits until `url` answers 200: a new address can take a few minutes to go live.
wait_for() {
    local url="$1" status=""
    for _ in $(seq 1 30); do
        status="$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)"
        if [[ "$status" == 200 ]]; then return 0; fi
        sleep 10
    done
    fail "${url} answered ${status} after 5 minutes. A new address may need more time: run the deploy again in 10 minutes (the deploy event, or Actions → CI → Run workflow)."
}

# The bots are connected only after both addresses answer, so Telegram never gets a dead webhook
# or a dead menu button.
smoke_test() {
    log "Smoke test"
    wait_for "${WORKER_URL}/health"
    wait_for "${APP_ORIGIN}/"
    echo "Worker:   ${WORKER_URL}"
    echo "Mini App: ${APP_ORIGIN}"
    {
        echo "### Deployed"
        echo "- Worker: ${WORKER_URL}"
        echo "- Mini App: ${APP_ORIGIN}"
    } >>"${GITHUB_STEP_SUMMARY:-/dev/null}"
}

main() {
    for name in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID PLATFORM_BOT_TOKEN PLATFORM_ADMIN_IDS COURIER_BOT_TOKEN BUSINESS_BOT_TOKEN; do
        [[ -n "${!name:-}" ]] || fail "Secret ${name} is not set."
    done
    ensure_d1
    ensure_r2
    ensure_pages
    ensure_app_domain
    deploy_worker
    deploy_app
    smoke_test
    connect_platform_bot
    connect_business_bot
    connect_courier_bot
}

main "$@"
