# Security

Zumda is developed in the open. The code is public; keys and customer data are not.

## Reporting a vulnerability

Please **do not** open a public issue. Use GitHub's private report instead:
**Security → Report a vulnerability** on this repository. We answer within 3 days.

## Where the secrets live

| Secret | Where | Never in |
|--------|-------|----------|
| Cloudflare API token, account id | GitHub Actions secrets | code, logs, issues |
| Zumda bots' tokens (Shop, Business, Kuryer), admin ids | GitHub Actions secrets → Worker secrets | code, logs |
| Browser sessions of Zumda \| Business (`BUSINESS_SESSION_SECRET`) | Derived from the Business bot token by the deploy → Worker secret; a new token signs every browser out | code, logs |
| `TOKEN_ENC_KEY` (encrypts shop bot tokens) | Worker secrets; optional saved copy in GitHub secrets and offline | code, chats, logs |
| Shop bot tokens | D1, encrypted with AES-GCM | API responses, logs |
| Local development | `packages/worker/.dev.vars` (git-ignored, fake tokens) | commits |

## How the repository protects them

- Pull requests and forks run CI with a read-only token and **no secrets**.
- The deploy job runs only for `main` of this repository (a push, a manual run or the `deploy`
  dispatch event, which only someone with write access can send), in the
  `production` environment. `main` takes only pull requests whose checks passed on code up to
  date with `main`. Only the deploy step receives the secrets.
- GitHub Actions are pinned to exact commits.
- `scripts/check-secrets.sh` runs in CI and as a git pre-commit hook: it blocks `.dev.vars`,
  `.env`, private keys and secret-looking values.

## If a key leaks

1. Revoke it at once. Zumda bot: `@BotFather` → `/revoke`; Cloudflare: roll the API token.
2. Put the new value into GitHub secrets and run **Actions → CI → Run workflow** on `main` (or ask
   Claude: it sends the `deploy` event).
3. Removing the commit is not enough: a pushed key is public forever; only revoking helps.

## Encryption key

`TOKEN_ENC_KEY` encrypts the shop bot tokens in D1. Cloudflare never shows a secret again, so a key
that exists only in the Worker is lost if the Worker or the secret is deleted. Then no shop bot
works, and every shop needs a manual repair.

- **Recommended, before the first deploy:** create the key yourself and keep two copies:
  1. run `openssl rand -base64 32` (macOS / Linux terminal, or Git Bash on Windows);
  2. save it in a password manager or on paper (offline);
  3. add it as the GitHub secret `TOKEN_ENC_KEY`.
- The deploy uses the GitHub copy **only when the Worker has no key**. A key added after the
  first deploy is ignored while the Worker has its own, so it cannot overwrite a working key.
- Without a saved copy the first deploy generates a key inside the Worker.
- **Guard:** if the Worker has no key but D1 already has shops, the deploy stops instead of
  making a new key (a new key would silently break every shop bot). Put the saved key into the
  GitHub secret `TOKEN_ENC_KEY` and run the deploy again.
- Never rotate the key by hand: the stored tokens would become unreadable.

## Backups and restore

D1 keeps every change for 7 days (Time Travel, free). Product photos in R2 are not in it: owners
upload them again if they are lost.

**Restore to a moment (the last 7 days):**
```bash
cd packages/worker
bunx wrangler login                                   # once, in the browser
bunx wrangler d1 time-travel info zumda                 # current bookmark
bunx wrangler d1 time-travel restore zumda --timestamp=2026-10-01T09:00:00+05:00
```
The restore replaces the whole database. It prints a bookmark to undo it.

**Weekly copy (older than 7 days), on your own computer:**
```bash
cd packages/worker
mkdir -p ../../backups
bunx wrangler d1 export zumda --remote --output=../../backups/zumda-$(date +%F).sql
```
- `backups/` is git-ignored. The file holds customer names and phones: keep it on an encrypted
  disk or in an encrypted archive, delete copies older than 3 months.
- **Never in CI:** artifacts and logs of a public repository are public.
- To load a copy into a new, empty database:
  `bunx wrangler d1 execute zumda --remote --file=../../backups/zumda-<date>.sql`.

## Alerts

Server errors (5xx) and failed Telegram notifications reach the platform admins through the Zumda
bot, at most one of each kind per 10 minutes. Alerts carry the error text only; bot tokens are
masked. "The customer blocked the bot" is normal and not reported.
