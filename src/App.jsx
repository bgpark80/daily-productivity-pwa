import { useEffect, useMemo, useState } from 'react';

const DEFAULT_REFRESH_MS = 5000;
const DEFAULT_ENDPOINT = '/api/metrics';
const SAMPLE_ENDPOINT = '/claude-metrics-sample.prom';
const DEFAULT_USAGE_LIMIT_ENDPOINT = '/api/usage-limit';
const SAMPLE_USAGE_LIMIT_ENDPOINT = '/claude-usage-limit-sample.json';
const LIMITS_STORAGE_KEY = 'claude-usage-dashboard-limits-v1';

const EMPTY_SNAPSHOT = {
  collectedAt: '',
  sessions: 0,
  costUsd: 0,
  tokens: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheCreation: 0,
    total: 0
  },
  lines: {
    added: 0,
    removed: 0
  },
  commits: 0,
  pullRequests: 0,
  activeSeconds: {
    cli: 0,
    user: 0,
    total: 0
  },
  editDecisions: {
    accept: 0,
    reject: 0
  },
  models: []
};

const EMPTY_USAGE_LIMIT = {
  plan: '',
  label: 'Plan usage limit',
  scope: 'Current session',
  usedPercent: 0,
  resetAt: '',
  resetLabel: '',
  statusText: '',
  description: ''
};

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
      canonicalName: normalizeMetricName(match[1])
    });
  }

  return metrics;
}

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

function aggregateMetrics(metrics) {
  const snapshot = {
    ...EMPTY_SNAPSHOT,
    collectedAt: new Date().toISOString(),
    tokens: { ...EMPTY_SNAPSHOT.tokens },
    lines: { ...EMPTY_SNAPSHOT.lines },
    activeSeconds: { ...EMPTY_SNAPSHOT.activeSeconds },
    editDecisions: { ...EMPTY_SNAPSHOT.editDecisions },
    models: []
  };
  const modelMap = new Map();

  for (const metric of metrics) {
    const name = metric.canonicalName;
    const modelName = metric.labels.model || 'unknown';
    const modelEntry = modelMap.get(modelName) || { name: modelName, costUsd: 0, tokens: 0 };

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
      modelMap.set(modelName, modelEntry);
      continue;
    }

    if (name.startsWith('claudecodetokenusage')) {
      const type = metric.labels.type || 'unknown';
      if (type in snapshot.tokens) {
        snapshot.tokens[type] += metric.value;
      }
      snapshot.tokens.total += metric.value;
      modelEntry.tokens += metric.value;
      modelMap.set(modelName, modelEntry);
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
      if (type === 'cli' || type === 'user') {
        snapshot.activeSeconds[type] += metric.value;
      }
      snapshot.activeSeconds.total += metric.value;
    }
  }

  snapshot.costUsd = roundToTwo(snapshot.costUsd);
  snapshot.models = [...modelMap.values()].sort((left, right) => {
    const costGap = right.costUsd - left.costUsd;
    if (costGap !== 0) {
      return costGap;
    }
    return right.tokens - left.tokens;
  });

  return snapshot;
}

function normalizeUsageLimit(rawValue) {
  const usedPercent = Number(rawValue?.usedPercent);

  return {
    plan: typeof rawValue?.plan === 'string' ? rawValue.plan : '',
    label: typeof rawValue?.label === 'string' ? rawValue.label : 'Plan usage limit',
    scope: typeof rawValue?.scope === 'string' ? rawValue.scope : 'Current session',
    usedPercent: Number.isFinite(usedPercent) ? clampPercent(usedPercent) : 0,
    resetAt: typeof rawValue?.resetAt === 'string' ? rawValue.resetAt : '',
    resetLabel: typeof rawValue?.resetLabel === 'string' ? rawValue.resetLabel : '',
    statusText: typeof rawValue?.statusText === 'string' ? rawValue.statusText : '',
    description: typeof rawValue?.description === 'string' ? rawValue.description : ''
  };
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainder}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainder}s`;
  }

  return `${remainder}s`;
}

function formatTimestamp(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString();
}

function readStoredLimits() {
  if (typeof window === 'undefined') {
    return { costLimit: '', tokenLimit: '' };
  }

  try {
    const rawValue = window.localStorage.getItem(LIMITS_STORAGE_KEY);
    if (!rawValue) {
      return { costLimit: '', tokenLimit: '' };
    }

    const parsed = JSON.parse(rawValue);
    return {
      costLimit: typeof parsed.costLimit === 'string' ? parsed.costLimit : '',
      tokenLimit: typeof parsed.tokenLimit === 'string' ? parsed.tokenLimit : ''
    };
  } catch {
    return { costLimit: '', tokenLimit: '' };
  }
}

function parseLimit(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

function StatCard({ label, value, tone = 'default', meta }) {
  return (
    <article className={`stat-card stat-card-${tone}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {meta ? <span className="stat-meta">{meta}</span> : null}
    </article>
  );
}

function MetricRow({ label, value, accent }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong className={accent ? `metric-${accent}` : ''}>{value}</strong>
    </div>
  );
}

function LimitProgress({ label, used, limit, formatter }) {
  if (!limit) {
    return (
      <div className="limit-progress">
        <div className="limit-progress-head">
          <span>{label}</span>
          <strong>No limit set</strong>
        </div>
      </div>
    );
  }

  const ratio = limit > 0 ? used / limit : 0;
  const percent = clampPercent(ratio * 100);
  const remaining = Math.max(0, limit - used);
  const exceeded = used > limit;

  return (
    <div className="limit-progress">
      <div className="limit-progress-head">
        <span>{label}</span>
        <strong className={exceeded ? 'metric-rose' : ''}>
          {formatter(used)} / {formatter(limit)}
        </strong>
      </div>
      <div className="progress-track">
        <div
          className={`progress-fill${exceeded ? ' danger' : ''}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="limit-progress-meta">
        <span>{formatNumber(percent, 1)}%</span>
        <span>{exceeded ? 'Exceeded' : `Remaining ${formatter(remaining)}`}</span>
      </div>
    </div>
  );
}

function App() {
  const [refreshMs, setRefreshMs] = useState(DEFAULT_REFRESH_MS);
  const [sourceMode, setSourceMode] = useState('live');
  const [status, setStatus] = useState('idle');
  const [lastError, setLastError] = useState('');
  const [lastRawText, setLastRawText] = useState('');
  const [backendSource, setBackendSource] = useState('unknown');
  const [usageLimitSource, setUsageLimitSource] = useState('unknown');
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [usageLimit, setUsageLimit] = useState(EMPTY_USAGE_LIMIT);
  const [limits, setLimits] = useState(() => readStoredLimits());

  const endpoint = sourceMode === 'sample' ? SAMPLE_ENDPOINT : DEFAULT_ENDPOINT;
  const usageLimitEndpoint =
    sourceMode === 'sample' ? SAMPLE_USAGE_LIMIT_ENDPOINT : DEFAULT_USAGE_LIMIT_ENDPOINT;
  const costLimitValue = parseLimit(limits.costLimit);
  const tokenLimitValue = parseLimit(limits.tokenLimit);

  useEffect(() => {
    window.localStorage.setItem(LIMITS_STORAGE_KEY, JSON.stringify(limits));
  }, [limits]);

  useEffect(() => {
    let cancelled = false;
    let timerId = 0;

    const loadDashboardData = async () => {
      setStatus((current) => (current === 'success' ? 'refreshing' : 'loading'));

      try {
        const [metricsResponse, usageLimitResponse] = await Promise.all([
          fetch(endpoint, {
            headers: {
              Accept: 'text/plain'
            },
            cache: 'no-store'
          }),
          fetch(usageLimitEndpoint, {
            headers: {
              Accept: 'application/json'
            },
            cache: 'no-store'
          })
        ]);

        if (!metricsResponse.ok) {
          throw new Error(`Metrics HTTP ${metricsResponse.status}`);
        }

        if (!usageLimitResponse.ok) {
          throw new Error(`Usage limit HTTP ${usageLimitResponse.status}`);
        }

        const [rawMetricsText, rawUsageLimit] = await Promise.all([
          metricsResponse.text(),
          usageLimitResponse.json()
        ]);

        if (cancelled) {
          return;
        }

        setLastRawText(rawMetricsText);
        setBackendSource(metricsResponse.headers.get('x-claude-metrics-source') || 'unknown');
        setUsageLimitSource(
          usageLimitResponse.headers.get('x-claude-usage-limit-source') || 'unknown'
        );
        setSnapshot(aggregateMetrics(parsePrometheusMetrics(rawMetricsText)));
        setUsageLimit(normalizeUsageLimit(rawUsageLimit));
        setLastError('');
        setStatus('success');
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLastError(error instanceof Error ? error.message : String(error));
        setBackendSource('unavailable');
        setUsageLimitSource('unavailable');
        setStatus('error');
      }

      if (!cancelled) {
        timerId = window.setTimeout(loadDashboardData, refreshMs);
      }
    };

    loadDashboardData();

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [endpoint, refreshMs, usageLimitEndpoint]);

  const connectionLabel = useMemo(() => {
    if (status === 'success' || status === 'refreshing') {
      return 'CONNECTED';
    }

    if (status === 'error') {
      return 'DISCONNECTED';
    }

    return 'CONNECTING';
  }, [status]);

  const connectionHint =
    sourceMode === 'sample'
      ? 'Sample mode uses bundled payloads and does not require a live backend.'
      : 'Live mode requires reachable same-origin /api/metrics and /api/usage-limit endpoints.';

  return (
    <main className="dashboard-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Claude Code PWA</p>
          <h1>Usage Dashboard</h1>
          <p className="hero-summary">
            Monitor Claude Code telemetry and plan usage in the browser. Live mode polls local
            same-origin API routes on a fixed interval.
          </p>
        </div>

        <div className="hero-actions">
          <button
            type="button"
            className={`mode-chip${sourceMode === 'live' ? ' active' : ''}`}
            onClick={() => setSourceMode('live')}
          >
            Live
          </button>
          <button
            type="button"
            className={`mode-chip${sourceMode === 'sample' ? ' active' : ''}`}
            onClick={() => setSourceMode('sample')}
          >
            Sample
          </button>
          <label className="refresh-control">
            <span>Refresh</span>
            <select value={refreshMs} onChange={(event) => setRefreshMs(Number(event.target.value))}>
              <option value={1000}>1s</option>
              <option value={3000}>3s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={30000}>30s</option>
            </select>
          </label>
        </div>
      </section>

      <section className="status-band">
        <div className={`status-pill ${connectionLabel.toLowerCase()}`}>{connectionLabel}</div>
        <div className="status-grid status-grid-wide">
          <MetricRow label="Metrics Source" value={backendSource} />
          <MetricRow label="Usage Limit Source" value={usageLimitSource} />
          <MetricRow label="Updated" value={formatTimestamp(snapshot.collectedAt)} />
          <MetricRow label="Metrics Path" value={endpoint} />
          <MetricRow label="Usage Limit Path" value={usageLimitEndpoint} />
          <MetricRow label="Hint" value={connectionHint} />
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel plan-usage-panel">
          <div className="panel-header">
            <div>
              <h2>{usageLimit.label}</h2>
              <p>{usageLimit.description || 'Plan session usage returned by /api/usage-limit.'}</p>
            </div>
            <span className="plan-badge">{usageLimit.plan || 'Unknown plan'}</span>
          </div>

          <div className="plan-usage-meta">
            <div>
              <span className="mini-label">{usageLimit.scope}</span>
              <strong className="plan-usage-value">{formatNumber(usageLimit.usedPercent)}%</strong>
            </div>
            <div>
              <span className="mini-label">Reset</span>
              <strong className="plan-usage-subvalue">
                {usageLimit.resetLabel || formatTimestamp(usageLimit.resetAt)}
              </strong>
            </div>
            <div>
              <span className="mini-label">Status</span>
              <strong className="plan-usage-subvalue">
                {usageLimit.statusText || `${formatNumber(usageLimit.usedPercent)}% used`}
              </strong>
            </div>
          </div>

          <div className="progress-track plan-usage-track">
            <div className="progress-fill" style={{ width: `${usageLimit.usedPercent}%` }} />
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Manual Limits</h2>
              <p>Track your own cost or token ceilings alongside the plan usage block.</p>
            </div>
          </div>

          <div className="limit-grid">
            <label className="limit-field">
              <span>Cost limit (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={limits.costLimit}
                onChange={(event) => setLimits((current) => ({ ...current, costLimit: event.target.value }))}
                placeholder="20"
              />
            </label>

            <label className="limit-field">
              <span>Token limit</span>
              <input
                type="number"
                min="0"
                step="1"
                value={limits.tokenLimit}
                onChange={(event) => setLimits((current) => ({ ...current, tokenLimit: event.target.value }))}
                placeholder="100000"
              />
            </label>
          </div>

          <div className="metric-list">
            <LimitProgress
              label="Cost"
              used={snapshot.costUsd}
              limit={costLimitValue}
              formatter={(value) => formatCurrency(value)}
            />
            <LimitProgress
              label="Tokens"
              used={snapshot.tokens.total}
              limit={tokenLimitValue}
              formatter={(value) => formatNumber(value)}
            />
          </div>
        </article>
      </section>

      <section className="stats-grid">
        <StatCard label="Session Cost" value={formatCurrency(snapshot.costUsd)} tone="warm" />
        <StatCard label="Total Tokens" value={formatNumber(snapshot.tokens.total)} tone="alert" />
        <StatCard
          label="Active Time"
          value={formatDuration(snapshot.activeSeconds.total)}
          meta={`cli ${formatDuration(snapshot.activeSeconds.cli)} / user ${formatDuration(snapshot.activeSeconds.user)}`}
        />
        <StatCard label="Sessions" value={formatNumber(snapshot.sessions)} />
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Token Breakdown</h2>
              <p>Cumulative token usage grouped by request type.</p>
            </div>
          </div>

          <div className="metric-list">
            <MetricRow label="Input" value={formatNumber(snapshot.tokens.input)} accent="cyan" />
            <MetricRow label="Output" value={formatNumber(snapshot.tokens.output)} accent="amber" />
            <MetricRow label="Cache Read" value={formatNumber(snapshot.tokens.cacheRead)} accent="green" />
            <MetricRow label="Cache Write" value={formatNumber(snapshot.tokens.cacheCreation)} accent="pink" />
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Activity</h2>
              <p>Code change and workflow counters.</p>
            </div>
          </div>

          <div className="metric-list">
            <MetricRow label="Lines Added" value={formatNumber(snapshot.lines.added)} accent="green" />
            <MetricRow label="Lines Removed" value={formatNumber(snapshot.lines.removed)} accent="rose" />
            <MetricRow label="Commits" value={formatNumber(snapshot.commits)} />
            <MetricRow label="Pull Requests" value={formatNumber(snapshot.pullRequests)} />
            <MetricRow label="Edit Accept" value={formatNumber(snapshot.editDecisions.accept)} accent="green" />
            <MetricRow label="Edit Reject" value={formatNumber(snapshot.editDecisions.reject)} accent="rose" />
          </div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Live Connection Checklist</h2>
              <p>Use this when the deployed app shows DISCONNECTED.</p>
            </div>
          </div>

          <div className="notes-list">
            <p>1. Confirm your server exposes same-origin `/api/metrics` and `/api/usage-limit` endpoints.</p>
            <p>2. In local dev, both endpoints default to sample mode unless upstream values are set.</p>
            <p>3. In production, set upstream environment variables so both API routes point at real data.</p>
            <p>4. If you only want to verify the UI, switch to Sample mode.</p>
          </div>

          {lastError ? (
            <div className="error-box">
              <strong>Last error</strong>
              <p>{lastError}</p>
            </div>
          ) : null}
        </article>

        <article className="panel models-panel">
          <div className="panel-header">
            <div>
              <h2>Top Models</h2>
              <p>Cost and token totals by model.</p>
            </div>
          </div>

          {snapshot.models.length === 0 ? (
            <div className="empty-state">No model usage has been collected yet.</div>
          ) : (
            <div className="models-table">
              <div className="models-row models-head">
                <span>Model</span>
                <span>Cost</span>
                <span>Tokens</span>
              </div>
              {snapshot.models.map((model) => (
                <div key={model.name} className="models-row">
                  <span>{model.name}</span>
                  <strong>{formatCurrency(model.costUsd)}</strong>
                  <strong>{formatNumber(model.tokens)}</strong>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="panel notes-panel">
        <div className="panel-header">
          <div>
            <h2>Raw Metrics</h2>
            <p>Inspect the current Prometheus payload received by the app.</p>
          </div>
        </div>

        <details className="raw-metrics" open={sourceMode === 'sample'}>
          <summary>Open payload</summary>
          <pre>{lastRawText || 'No metrics loaded yet.'}</pre>
        </details>
      </section>
    </main>
  );
}

export default App;
