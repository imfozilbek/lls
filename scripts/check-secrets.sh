#!/usr/bin/env bash
# Blocks secrets from reaching this PUBLIC repository.
#
#   scripts/check-secrets.sh           staged files (git pre-commit hook)
#   scripts/check-secrets.sh --all     every tracked file (CI)
#
# Finds secret files (.dev.vars, .env, private keys) and secret-looking values: Telegram bot tokens,
# Cloudflare API tokens, private key blocks, and values assigned to our secret names.
# Test and dev fixtures use fake tokens that do not match these patterns. A fake value that does
# match (e.g. a test encryption key) carries a "secret-scan: fake" comment on the same line.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if [[ "${1:-}" == "--all" ]]; then
    mapfile -t files < <(git ls-files)
else
    mapfile -t files < <(git diff --cached --name-only --diff-filter=ACMR)
fi

# Files that must never be committed. Examples and templates are fine.
readonly SECRET_FILES='(^|/)(\.dev\.vars(\..+)?|\.env(\..+)?|.*\.pem|.*\.p12|.*\.key|id_(rsa|ed25519|ecdsa))$'
readonly ALLOWED_FILES='\.(example|sample|template)$'

readonly PATTERNS=(
    # Telegram bot token: <bot id>:AA<33 chars>
    '[0-9]{6,12}:AA[A-Za-z0-9_-]{30,}'
    # Private key blocks
    '-----BEGIN ([A-Z]+ )?PRIVATE KEY-----'
    # A real value assigned to one of our secret names (quotes optional)
    '(CLOUDFLARE_API_TOKEN|PLATFORM_BOT_TOKEN|PLATFORM_WEBHOOK_SECRET|TOKEN_ENC_KEY)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9_+/=-]{32,}'
)

found=0
for file in "${files[@]}"; do
    [[ -f "$file" ]] || continue
    if [[ "$file" =~ $SECRET_FILES && ! "$file" =~ $ALLOWED_FILES ]]; then
        echo "✗ secret file must not be committed: $file" >&2
        found=1
        continue
    fi
    for pattern in "${PATTERNS[@]}"; do
        # -I skips binary files. Print file:line only, never the secret itself.
        if lines="$(grep -EIn -e "$pattern" -- "$file" | grep -v 'secret-scan: fake' | cut -d: -f1 | paste -sd, -)" &&
            [[ -n "$lines" ]]; then
            echo "✗ looks like a secret: $file (line $lines)" >&2
            found=1
        fi
    done
done

if [[ "$found" -ne 0 ]]; then
    echo "Secrets must live only in GitHub secrets, Cloudflare (wrangler secret put) or .dev.vars." >&2
    echo "If a real key was ever pushed, revoke it first (BotFather /revoke, Cloudflare token roll)." >&2
    exit 1
fi
echo "✓ no secrets in ${#files[@]} file(s)"
