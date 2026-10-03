#!/usr/bin/env bash
# Blocks the em dash (U+2014) everywhere in the repository: code, comments, product texts, docs
# (owner's decision, October 2026). Use a colon, a comma, a period or a hyphen " - " instead.
#
#   scripts/check-dashes.sh           staged files (git pre-commit hook)
#   scripts/check-dashes.sh --all     every tracked file (CI)
#
# Generated files are skipped: `worker-configuration.d.ts` comes from `wrangler types`.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# The character itself, as bytes: this script must not contain it.
EM_DASH="$(printf '\xe2\x80\x94')"
readonly EM_DASH
readonly GENERATED='(^|/)worker-configuration\.d\.ts$'

if [[ "${1:-}" == "--all" ]]; then
    mapfile -t files < <(git ls-files)
else
    mapfile -t files < <(git diff --cached --name-only --diff-filter=ACMR)
fi

found=0
for file in "${files[@]}"; do
    [[ -f "$file" && ! "$file" =~ $GENERATED ]] || continue
    # -I skips binary files (images, fonts).
    if matches="$(grep -InF -- "$EM_DASH" "$file")"; then
        while IFS= read -r line; do
            echo "✗ em dash in ${file}:${line%%:*}" >&2
        done <<<"$matches"
        found=1
    fi
done

if ((found)); then
    echo "Replace the em dash with a colon, a comma, a period or a hyphen \" - \" (CLAUDE.md, Code Style)." >&2
    exit 1
fi
echo "✓ no em dashes in ${#files[@]} file(s)"
