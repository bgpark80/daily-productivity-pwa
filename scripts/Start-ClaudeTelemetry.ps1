param(
    [string]$Host = "127.0.0.1",
    [int]$Port = 9464,
    [string]$ClaudeCommand = "claude",
    [switch]$EnableConsoleLogs
)

$env:CLAUDE_CODE_ENABLE_TELEMETRY = "1"
$env:OTEL_METRICS_EXPORTER = "prometheus"
$env:OTEL_METRIC_EXPORT_INTERVAL = "5000"
$env:OTEL_EXPORTER_PROMETHEUS_HOST = $Host
$env:OTEL_EXPORTER_PROMETHEUS_PORT = "$Port"

if ($EnableConsoleLogs) {
    $env:OTEL_LOGS_EXPORTER = "console"
}

Write-Host "Claude Code telemetry enabled." -ForegroundColor Green
Write-Host "Metrics endpoint: http://$Host`:$Port/metrics" -ForegroundColor Cyan
Write-Host "Metric export interval: $env:OTEL_METRIC_EXPORT_INTERVAL ms" -ForegroundColor Cyan
Write-Host "Starting Claude Code with command: $ClaudeCommand" -ForegroundColor Cyan

& $ClaudeCommand
