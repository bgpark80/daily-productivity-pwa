param(
    [string]$Endpoint = "http://localhost:9464/metrics",
    [int]$IntervalSeconds = 5,
    [switch]$Once
)

$arguments = @(
    "scripts/claude-usage-monitor.mjs",
    "--endpoint",
    $Endpoint,
    "--interval",
    "$($IntervalSeconds * 1000)"
)

if ($Once) {
    $arguments += "--once"
}

node @arguments
