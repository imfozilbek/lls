#!/usr/bin/env bash
# Checks that the launch keys work, before the first deploy. Read-only: it changes nothing.
#
#   scripts/check-access.sh
#
# Reads CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, PLATFORM_BOT_TOKEN, BUSINESS_BOT_TOKEN, COURIER_BOT_TOKEN and
# PLATFORM_ADMIN_IDS from the environment (Claude's cloud environment, or your shell). It never
# prints their values: only OK / FAIL per check and what to do about a FAIL.
# Steps to create the keys: docs/launch-checklist.md.
set -uo pipefail

readonly CF_API="https://api.cloudflare.com/client/v4"
readonly TG_API="https://api.telegram.org"
readonly ZONE="zumda.shop"
readonly PLATFORM_BOT="zumdashop_bot"
readonly COURIER_BOT="zumdashop_kuryer_bot"
readonly BUSINESS_BOT="zumdashop_business_bot"

failures=0

ok() { printf 'OK    %s\n' "$1"; }
warn() { printf 'WARN  %s: %s\n' "$1" "$2"; }
bad() {
    printf 'FAIL  %s: %s\n' "$1" "$2"
    failures=$((failures + 1))
}

# GET a Cloudflare API path; prints the JSON body (an error body when the call fails).
cf() {
    curl -sS -m 20 -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" "${CF_API}$1" 2>/dev/null ||
        echo '{"success":false,"errors":[{"message":"no connection"}]}'
}

cf_ok() { jq -e '.success == true' >/dev/null 2>&1 <<<"$1"; }
cf_error() { jq -r '[.errors[]?.message] | join("; ") | if . == "" then "unknown error" else . end' <<<"$1" 2>/dev/null; }

check_variables() {
    local missing=0
    for name in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID PLATFORM_BOT_TOKEN COURIER_BOT_TOKEN BUSINESS_BOT_TOKEN PLATFORM_ADMIN_IDS; do
        if [[ -n "${!name:-}" ]]; then
            ok "variable ${name} is set"
        else
            bad "variable ${name}" "missing: add it to the environment, then open a new session"
            missing=1
        fi
    done
    return "$missing"
}

check_admins() {
    if [[ "${PLATFORM_ADMIN_IDS:-}" =~ ^[0-9]+(,[0-9]+)*$ ]]; then
        ok "PLATFORM_ADMIN_IDS are Telegram ids"
    else
        bad "PLATFORM_ADMIN_IDS" "must be numbers separated by commas (ask @userinfobot)"
    fi
}

check_cloudflare_token() {
    local body
    body="$(cf "/accounts/${CLOUDFLARE_ACCOUNT_ID}/tokens/verify")"
    cf_ok "$body" || body="$(cf "/user/tokens/verify")"
    if cf_ok "$body" && [[ "$(jq -r '.result.status' <<<"$body")" == "active" ]]; then
        ok "Cloudflare token is active"
    else
        bad "Cloudflare token" "$(cf_error "$body"): create it again (checklist, step 3)"
        return 1
    fi
    body="$(cf "/accounts/${CLOUDFLARE_ACCOUNT_ID}")"
    if cf_ok "$body"; then
        ok "Cloudflare account is reachable"
    else
        bad "Cloudflare account" "$(cf_error "$body"): check CLOUDFLARE_ACCOUNT_ID and the token's account"
    fi
}

check_zone() {
    local body zone
    body="$(cf "/zones?name=${ZONE}")"
    zone="$(jq -r '.result[0].id // empty' <<<"$body" 2>/dev/null)"
    if [[ -z "$zone" ]]; then
        bad "zone ${ZONE}" "not visible to the token: add Zone permissions for ${ZONE}"
        return
    fi
    local status
    status="$(jq -r '.result[0].status' <<<"$body")"
    if [[ "$status" == "active" ]]; then
        ok "zone ${ZONE} is active"
    else
        bad "zone ${ZONE}" "status '${status}': the nameservers are not switched yet"
    fi
    local ssl https
    ssl="$(jq -r '.result.value // empty' <<<"$(cf "/zones/${zone}/settings/ssl")")"
    https="$(jq -r '.result.value // empty' <<<"$(cf "/zones/${zone}/settings/always_use_https")")"
    if [[ -z "$ssl" ]]; then
        bad "zone settings" "the token cannot read them: add Zone → Zone Settings → Edit"
        return
    fi
    if [[ "$ssl" == "strict" ]]; then ok "SSL mode is Full (strict)"; else warn "SSL mode is '${ssl}'" "Claude sets Full (strict)"; fi
    if [[ "$https" == "on" ]]; then ok "Always Use HTTPS is on"; else warn "Always Use HTTPS is '${https}'" "Claude turns it on"; fi
}

check_account_products() {
    local base="/accounts/${CLOUDFLARE_ACCOUNT_ID}" body
    body="$(cf "${base}/r2/buckets")"
    if cf_ok "$body"; then ok "R2 is enabled"; else bad "R2" "$(cf_error "$body"): enable R2 (checklist, step 2)"; fi
    body="$(cf "${base}/d1/database")"
    if cf_ok "$body"; then ok "D1 is reachable"; else bad "D1" "$(cf_error "$body"): add Account → D1 → Edit"; fi
    body="$(cf "${base}/pages/projects")"
    if cf_ok "$body"; then ok "Pages is reachable"; else bad "Pages" "$(cf_error "$body"): add Account → Cloudflare Pages → Edit"; fi
    body="$(cf "${base}/workers/scripts")"
    if cf_ok "$body"; then ok "Workers are reachable"; else bad "Workers" "$(cf_error "$body"): add Account → Workers Scripts → Edit"; fi
}

check_bot() {
    local label="$1" token="$2" expected="$3" body username
    body="$(curl -sS -m 20 "${TG_API}/bot${token}/getMe" 2>/dev/null || echo '{"ok":false}')"
    username="$(jq -r '.result.username // empty' <<<"$body" 2>/dev/null)"
    if [[ -z "$username" ]]; then
        bad "$label" "Telegram does not accept the token: copy it again from @BotFather"
    elif [[ -n "$expected" && "$username" != "$expected" ]]; then
        bad "$label" "the token belongs to @${username}, expected @${expected}"
    else
        ok "${label} is @${username}"
    fi
}

# Goal 14: Zumda | Business creates shop bots for owners (Telegram Managed Bots).
check_bot_management() {
    local body username
    body="$(curl -sS -m 20 "${TG_API}/bot${BUSINESS_BOT_TOKEN}/getMe" 2>/dev/null || echo '{"ok":false}')"
    username="$(jq -r '.result.username // "the Zumda | Business bot"' <<<"$body" 2>/dev/null)"
    if [[ "$(jq -r '.result.can_manage_bots // false' <<<"$body" 2>/dev/null)" == "true" ]]; then
        ok "@${username} can create bots for owners (can_manage_bots)"
    else
        bad "Bot Management Mode" "@BotFather → @${username} → Bot Settings → Bot Management Mode → On"
    fi
}

echo "Launch access check (values are never printed)"
if check_variables; then
    check_admins
    if check_cloudflare_token; then
        check_zone
        check_account_products
    fi
    check_bot "PLATFORM_BOT_TOKEN" "$PLATFORM_BOT_TOKEN" "$PLATFORM_BOT"
    check_bot "BUSINESS_BOT_TOKEN" "$BUSINESS_BOT_TOKEN" "$BUSINESS_BOT"
    check_bot_management
    check_bot "COURIER_BOT_TOKEN" "$COURIER_BOT_TOKEN" "$COURIER_BOT"
fi

if ((failures > 0)); then
    echo "${failures} check(s) failed."
    exit 1
fi
echo "All access checks passed."
