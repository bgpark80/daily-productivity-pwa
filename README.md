# Claude Usage Dashboard PWA

Cloudflare Pages deployment-ready dashboard for Claude Code telemetry and plan usage.

## What changed for Cloudflare

- `/api/metrics` is now implemented as a Pages Function at [functions/api/metrics.js](/abs/path/D:/GIT_PWA/functions/api/metrics.js:1)
- `/api/usage-limit` is now implemented as a Pages Function at [functions/api/usage-limit.js](/abs/path/D:/GIT_PWA/functions/api/usage-limit.js:1)
- Cloudflare Pages config lives in [wrangler.jsonc](/abs/path/D:/GIT_PWA/wrangler.jsonc:1)
- deploy should use `wrangler pages deploy`, not `wrangler deploy`

This matters because your project is a static frontend plus same-origin API routes. That matches Cloudflare Pages Functions, not a plain Workers script deploy.

## Local development

Vite only:

```powershell
cd D:\GIT_PWA
npm run claude:web
```

Cloudflare Pages locally:

```powershell
cd D:\GIT_PWA
npm run cf:dev
```

## Cloudflare deploy

Use this command:

```powershell
cd D:\GIT_PWA
npm run cf:deploy
```

Do not use:

```powershell
wrangler deploy
```

## Required environment variables

Pages Functions can read these variables from Cloudflare Pages project settings:

- `CLAUDE_METRICS_MODE=sample|upstream`
- `CLAUDE_METRICS_UPSTREAM=https://example.com/metrics`
- `CLAUDE_USAGE_LIMIT_MODE=sample|upstream`
- `CLAUDE_USAGE_LIMIT_UPSTREAM=https://example.com/usage-limit.json`

If you do not set upstream values, the app falls back to bundled sample responses.

## Cloudflare token notes

If you deploy from CI or a non-interactive environment, use:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

For Pages deploys, the token should include at least `Pages Write` on the target account.

Reference:

- Cloudflare Pages Functions routing: https://developers.cloudflare.com/pages/functions/routing/
- Cloudflare Pages Wrangler configuration: https://developers.cloudflare.com/pages/functions/wrangler-configuration/
- Cloudflare Direct Upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Cloudflare API token permissions: https://developers.cloudflare.com/fundamentals/api/reference/permissions/
