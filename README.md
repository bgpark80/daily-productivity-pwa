# Claude Usage Dashboard PWA

Claude Code telemetry usage dashboard for web deployment.

## What it shows

- session cost estimate
- token usage by type
- session count
- lines added and removed
- commit and pull request counts
- active time and edit accept/reject counts
- model-by-model cost and token totals
- manual cost and token limits

## Important limitation

This app visualizes telemetry usage. It does not know the exact remaining quota of a personal Claude subscription.

## Unified local and production model

Local development and production now use the same contract:

- the frontend reads only `GET /api/metrics`
- the backend decides whether `/api/metrics` serves sample data or proxies an upstream metrics source

Supported environment variables:

- `CLAUDE_METRICS_MODE=sample|upstream`
- `CLAUDE_METRICS_UPSTREAM=http://host:port/metrics`
- `CLAUDE_METRICS_SAMPLE_PATH=relative/or/absolute/path`
- `CLAUDE_USAGE_LIMIT_MODE=sample|upstream`
- `CLAUDE_USAGE_LIMIT_UPSTREAM=https://host/api/usage-limit.json`
- `CLAUDE_USAGE_LIMIT_SAMPLE_PATH=relative/or/absolute/path`

Behavior:

- if `CLAUDE_METRICS_MODE` is omitted and no upstream is set, `/api/metrics` serves the bundled sample file
- if `CLAUDE_METRICS_MODE=upstream`, `/api/metrics` proxies `CLAUDE_METRICS_UPSTREAM`
- if `CLAUDE_USAGE_LIMIT_MODE` is omitted and no upstream is set, `/api/usage-limit` serves the bundled sample JSON
- if `CLAUDE_USAGE_LIMIT_MODE=upstream`, `/api/usage-limit` proxies `CLAUDE_USAGE_LIMIT_UPSTREAM`

## Local development

Default local run:

```powershell
cd D:\GIT_PWA
npm run claude:web
```

Then open:

```text
http://localhost:5173
```

This works immediately because local `/api/metrics` defaults to sample mode.

### Local development with a real metrics upstream

```powershell
$env:CLAUDE_METRICS_MODE="upstream"
$env:CLAUDE_METRICS_UPSTREAM="http://127.0.0.1:9464/metrics"
$env:CLAUDE_USAGE_LIMIT_MODE="upstream"
$env:CLAUDE_USAGE_LIMIT_UPSTREAM="https://your-server.example/api/usage-limit.json"
npm run claude:web
```

## Production-style local run

```powershell
npm run build
npm run claude:pwa
```

Then open:

```text
http://localhost:4173
```

### Production-style local run with a real metrics upstream

```powershell
$env:CLAUDE_METRICS_MODE="upstream"
$env:CLAUDE_METRICS_UPSTREAM="http://127.0.0.1:9464/metrics"
$env:CLAUDE_USAGE_LIMIT_MODE="upstream"
$env:CLAUDE_USAGE_LIMIT_UPSTREAM="https://your-server.example/api/usage-limit.json"
npm run build
npm run claude:pwa
```

## Deployment note

In production, deploy the static frontend and make sure the same origin serves both `/api/metrics` and `/api/usage-limit`.
