# Security

LLS is developed in the open. The code is public; keys and customer data are not.

## Reporting a vulnerability

Please **do not** open a public issue. Use GitHub's private report instead:
**Security → Report a vulnerability** on this repository. We answer within 3 days.

## Where the secrets live

| Secret | Where | Never in |
|--------|-------|----------|
| Cloudflare API token, account id | GitHub Actions secrets | code, logs, issues |
| LLS bot token, admin ids | GitHub Actions secrets → Worker secrets | code, logs |
| `TOKEN_ENC_KEY` (encrypts shop bot tokens) | Worker secrets only, generated on the first deploy | anywhere else |
| Shop bot tokens | D1, encrypted with AES-GCM | API responses, logs |
| Local development | `packages/worker/.dev.vars` (git-ignored, fake tokens) | commits |

## How the repository protects them

- Pull requests and forks run CI with a read-only token and **no secrets**.
- The deploy job runs only for a push to `main` of this repository, after green checks, in the
  `production` environment. Only the deploy step receives the secrets.
- GitHub Actions are pinned to exact commits.
- `scripts/check-secrets.sh` runs in CI and as a git pre-commit hook: it blocks `.dev.vars`,
  `.env`, private keys and secret-looking values.

## If a key leaks

1. Revoke it at once: LLS bot — `@BotFather` → `/revoke`; Cloudflare — roll the API token.
2. Put the new value into GitHub secrets and run **Actions → CI → Run workflow** on `main`.
3. Removing the commit is not enough: a pushed key is public forever; only revoking helps.
