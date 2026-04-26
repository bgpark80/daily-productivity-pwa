import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const defaultSamplePath = path.join(rootDir, 'public', 'claude-metrics-sample.prom');

function normalizeMode(rawMode, hasUpstream) {
  if (rawMode === 'upstream') {
    return 'upstream';
  }

  if (rawMode === 'sample') {
    return 'sample';
  }

  return hasUpstream ? 'upstream' : 'sample';
}

function resolveSamplePath(rawPath) {
  if (!rawPath) {
    return defaultSamplePath;
  }

  return path.isAbsolute(rawPath) ? rawPath : path.resolve(rootDir, rawPath);
}

export function resolveMetricsConfig(env = process.env) {
  const upstream = env.CLAUDE_METRICS_UPSTREAM || '';
  const mode = normalizeMode(env.CLAUDE_METRICS_MODE || '', Boolean(upstream));
  const samplePath = resolveSamplePath(env.CLAUDE_METRICS_SAMPLE_PATH || '');

  return {
    mode,
    upstream,
    samplePath
  };
}

async function buildSamplePayload(config) {
  const body = await fsp.readFile(config.samplePath, 'utf8');

  return {
    statusCode: 200,
    body,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Claude-Metrics-Source': 'sample'
    }
  };
}

function buildJsonPayload(statusCode, payload, source = 'error') {
  return {
    statusCode,
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Claude-Metrics-Source': source
    }
  };
}

async function buildUpstreamPayload(config) {
  if (!config.upstream) {
    return buildJsonPayload(500, {
      error: 'MissingMetricsUpstream',
      message: 'CLAUDE_METRICS_UPSTREAM is not configured.',
      hint: 'Set CLAUDE_METRICS_UPSTREAM or switch CLAUDE_METRICS_MODE=sample.'
    });
  }

  try {
    const response = await fetch(config.upstream, {
      headers: {
        Accept: 'text/plain'
      },
      cache: 'no-store'
    });
    const body = await response.text();

    return {
      statusCode: response.status,
      body,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Claude-Metrics-Source': 'upstream'
      }
    };
  } catch (error) {
    return buildJsonPayload(502, {
      error: 'MetricsUpstreamUnavailable',
      message: error instanceof Error ? error.message : String(error),
      hint: 'Check the upstream metrics URL or switch CLAUDE_METRICS_MODE=sample.'
    });
  }
}

export async function getMetricsPayload(env = process.env) {
  const config = resolveMetricsConfig(env);

  if (config.mode === 'sample') {
    return buildSamplePayload(config);
  }

  return buildUpstreamPayload(config);
}

export async function sendMetricsResponse(response, env = process.env) {
  const payload = await getMetricsPayload(env);
  response.writeHead(payload.statusCode, payload.headers);
  response.end(payload.body);
}

export function describeMetricsMode(env = process.env) {
  const config = resolveMetricsConfig(env);

  if (config.mode === 'sample') {
    return `sample (${config.samplePath})`;
  }

  return `upstream (${config.upstream})`;
}
