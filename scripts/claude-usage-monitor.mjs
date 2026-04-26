import fs from 'node:fs/promises';

const DEFAULT_HOST = process.env.OTEL_EXPORTER_PROMETHEUS_HOST || 'localhost';
const DEFAULT_PORT = process.env.OTEL_EXPORTER_PROMETHEUS_PORT || '9464';
const DEFAULT_ENDPOINT =
  process.env.CLAUDE_METRICS_ENDPOINT ||
  `http://${DEFAULT_HOST}:${DEFAULT_PORT}/metrics`;
const DEFAULT_INTERVAL_MS = Number(process.env.CLAUDE_MONITOR_INTERVAL_MS || 5000);

function parseArgs(argv) {
  const options = {
    endpoint: DEFAULT_ENDPOINT,
    intervalMs: DEFAULT_INTERVAL_MS,
    once: false,
    inputPath: '',
    noClear: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--endpoint' && argv[index + 1]) {
      options.endpoint = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === '--interval' && argv[index + 1]) {
      const parsed = Number(argv[index + 1]);
      if (!Number.isNaN(parsed) && parsed > 0) {
        options.intervalMs = parsed;
      }
      index += 1;
      continue;
    }

    if (token === '--input' && argv[index + 1]) {
      options.inputPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === '--once') {
      options.once = true;
      continue;
    }

    if (token === '--no-clear') {
      options.noClear = true;
      continue;
    }

    if (token === '--help' || token === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  const lines = [
    'Claude Code Usage Monitor',
    '',
    'Usage:',
    '  node scripts/claude-usage-monitor.mjs [options]',
    '',
    'Options:',
    `  --endpoint <url>   Metrics endpoint. Default: ${DEFAULT_ENDPOINT}`,
    `  --interval <ms>    Refresh interval in milliseconds. Default: ${DEFAULT_INTERVAL_MS}`,
    '  --input <path>     Read Prometheus metrics from a local file instead of HTTP.',
    '  --once             Print one snapshot and exit.',
    '  --no-clear         Do not clear the terminal between refreshes.',
    '  --help             Show this help.',
  ];

  process.stdout.write(`${lines.join('\n')}\n`);
}

function normalizeMetricName(metricName) {
  return metricName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseLabels(rawLabels) {
  if (!rawLabels) {
    return {};
  }

  const labels = {};
  const matcher = /(\w+)="((?:\\"|[^"])*)"/g;

  for (const match of rawLabels.matchAll(matcher)) {
    labels[match[1]] = match[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }

  return labels;
}

function parsePrometheusMetrics(rawText) {
  const metrics = [];
  const lines = rawText.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(
      /^([^{\s]+)(?:\{([^}]*)\})?\s+([-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?)$/
    );

    if (!match) {
      continue;
    }

    metrics.push({
      name: match[1],
      labels: parseLabels(match[2]),
      value: Number(match[3]),
      canonicalName: normalizeMetricName(match[1]),
    });
  }

  return metrics;
}

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

function aggregateMetrics(metrics) {
  const snapshot = {
    collectedAt: new Date(),
    sessions: 0,
    costUsd: 0,
    tokens: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheCreation: 0,
      total: 0,
    },
    lines: {
      added: 0,
      removed: 0,
    },
    commits: 0,
    pullRequests: 0,
    activeSeconds: {
      user: 0,
      cli: 0,
      total: 0,
    },
    editDecisions: {
      accept: 0,
      reject: 0,
    },
    models: new Map(),
  };

  for (const metric of metrics) {
    const name = metric.canonicalName;
    const modelName = metric.labels.model || 'unknown';
    const modelEntry =
      snapshot.models.get(modelName) ||
      {
        costUsd: 0,
        tokens: 0,
      };

    if (name.startsWith('claudecodesessioncount')) {
      snapshot.sessions += metric.value;
      continue;
    }

    if (name.startsWith('claudecodelinesofcodecount')) {
      if (metric.labels.type === 'removed') {
        snapshot.lines.removed += metric.value;
      } else {
        snapshot.lines.added += metric.value;
      }
      continue;
    }

    if (name.startsWith('claudecodepullrequestcount')) {
      snapshot.pullRequests += metric.value;
      continue;
    }

    if (name.startsWith('claudecodecommitcount')) {
      snapshot.commits += metric.value;
      continue;
    }

    if (name.startsWith('claudecodecostusage')) {
      snapshot.costUsd += metric.value;
      modelEntry.costUsd += metric.value;
      snapshot.models.set(modelName, modelEntry);
      continue;
    }

    if (name.startsWith('claudecodetokenusage')) {
      const type = metric.labels.type || 'unknown';
      if (type in snapshot.tokens) {
        snapshot.tokens[type] += metric.value;
      }
      snapshot.tokens.total += metric.value;
      modelEntry.tokens += metric.value;
      snapshot.models.set(modelName, modelEntry);
      continue;
    }

    if (name.startsWith('claudecodecodeedittooldecision')) {
      const decision = metric.labels.decision || 'unknown';
      if (decision in snapshot.editDecisions) {
        snapshot.editDecisions[decision] += metric.value;
      }
      continue;
    }

    if (name.startsWith('claudecodeactivetimetotal')) {
      const type = metric.labels.type;
      if (type === 'user' || type === 'cli') {
        snapshot.activeSeconds[type] += metric.value;
      }
      snapshot.activeSeconds.total += metric.value;
    }
  }

  snapshot.costUsd = roundToTwo(snapshot.costUsd);
  return snapshot;
}

async function readMetricSource(options) {
  if (options.inputPath) {
    return fs.readFile(options.inputPath, 'utf8');
  }

  const response = await fetch(options.endpoint, {
    headers: {
      Accept: 'text/plain',
    },
  });

  if (!response.ok) {
    throw new Error(`metrics endpoint returned HTTP ${response.status}`);
  }

  return response.text();
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function renderSnapshot(snapshot, options, state) {
  const status = state.lastError ? 'DISCONNECTED' : 'CONNECTED';
  const sourceLabel = options.inputPath || options.endpoint;
  const sortedModels = [...snapshot.models.entries()]
    .sort((left, right) => {
      const costGap = right[1].costUsd - left[1].costUsd;
      if (costGap !== 0) {
        return costGap;
      }
      return right[1].tokens - left[1].tokens;
    })
    .slice(0, 5);

  const lines = [
    'Claude Code Usage Monitor',
    '================================================================',
    `Status      ${status}`,
    `Source      ${sourceLabel}`,
    `Updated     ${snapshot.collectedAt.toLocaleString()}`,
    `Refresh     ${formatNumber(options.intervalMs / 1000, 1)}s`,
    'Note        Local telemetry view. This is not account remaining quota.',
    '',
    'Session',
    `Sessions    ${formatNumber(snapshot.sessions)}`,
    `Cost        ${formatCurrency(snapshot.costUsd)}`,
    `Active      ${formatDuration(snapshot.activeSeconds.total)}  (cli ${formatDuration(
      snapshot.activeSeconds.cli
    )} / user ${formatDuration(snapshot.activeSeconds.user)})`,
    '',
    'Tokens',
    `Input       ${formatNumber(snapshot.tokens.input)}`,
    `Output      ${formatNumber(snapshot.tokens.output)}`,
    `Cache Read  ${formatNumber(snapshot.tokens.cacheRead)}`,
    `Cache Write ${formatNumber(snapshot.tokens.cacheCreation)}`,
    `Total       ${formatNumber(snapshot.tokens.total)}`,
    '',
    'Activity',
    `Lines +     ${formatNumber(snapshot.lines.added)}`,
    `Lines -     ${formatNumber(snapshot.lines.removed)}`,
    `Commits     ${formatNumber(snapshot.commits)}`,
    `PRs         ${formatNumber(snapshot.pullRequests)}`,
    `Edits       accept ${formatNumber(snapshot.editDecisions.accept)} / reject ${formatNumber(
      snapshot.editDecisions.reject
    )}`,
    '',
    'Top Models',
  ];

  if (sortedModels.length === 0) {
    lines.push('No model usage found yet.');
  } else {
    for (const [modelName, modelStats] of sortedModels) {
      lines.push(
        `${modelName.padEnd(24)} ${formatCurrency(modelStats.costUsd).padStart(10)}  ${formatNumber(
          modelStats.tokens
        ).padStart(12)} tok`
      );
    }
  }

  if (state.lastError) {
    lines.push('');
    lines.push(`Last error  ${state.lastError}`);
    lines.push(
      'Hint        Run Claude Code with CLAUDE_CODE_ENABLE_TELEMETRY=1 and OTEL_METRICS_EXPORTER=prometheus.'
    );
  }

  return lines.join('\n');
}

async function collectSnapshot(options) {
  const rawText = await readMetricSource(options);
  const metrics = parsePrometheusMetrics(rawText);
  return aggregateMetrics(metrics);
}

async function monitor(options) {
  const state = {
    lastError: '',
    lastSnapshot: null,
  };

  while (true) {
    try {
      state.lastSnapshot = await collectSnapshot(options);
      state.lastError = '';
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      if (!state.lastSnapshot) {
        state.lastSnapshot = aggregateMetrics([]);
      }
      state.lastSnapshot.collectedAt = new Date();
    }

    const output = renderSnapshot(state.lastSnapshot, options, state);
    if (!options.noClear) {
      console.clear();
    }
    process.stdout.write(`${output}\n`);

    if (options.once) {
      if (state.lastError) {
        process.exitCode = 1;
      }
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, options.intervalMs);
    });
  }
}

const options = parseArgs(process.argv.slice(2));
monitor(options).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
