import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const defaultSamplePath = path.join(rootDir, 'public', 'claude-usage-limit-sample.json');

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

export function resolveUsageLimitConfig(env = process.env) {
  const upstream = env.CLAUDE_USAGE_LIMIT_UPSTREAM || '';
  const mode = normalizeMode(env.CLAUDE_USAGE_LIMIT_MODE || '', Boolean(upstream));
  const samplePath = resolveSamplePath(env.CLAUDE_USAGE_LIMIT_SAMPLE_PATH || '');

  return {
    mode,
    upstream,
    samplePath
  };
}

function buildJsonPayload(statusCode, payload, source = 'error') {
  return {
    statusCode,
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Claude-Usage-Limit-Source': source
    }
  };
}

async function buildSamplePayload(config) {
  const body = await fsp.readFile(config.samplePath, 'utf8');

  return {
    statusCode: 200,
    body,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Claude-Usage-Limit-Source': 'sample'
    }
  };
}

async function buildUpstreamPayload(config) {
  if (!config.upstream) {
    return buildJsonPayload(500, {
      error: 'MissingUsageLimitUpstream',
      message: 'CLAUDE_USAGE_LIMIT_UPSTREAM is not configured.',
      hint: 'Set CLAUDE_USAGE_LIMIT_UPSTREAM or switch CLAUDE_USAGE_LIMIT_MODE=sample.'
    });
  }

  try {
    const response = await fetch(config.upstream, {
      headers: {
        Accept: 'application/json'
      },
      cache: 'no-store'
    });
    const body = await response.text();

    return {
      statusCode: response.status,
      body,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Claude-Usage-Limit-Source': 'upstream'
      }
    };
  } catch (error) {
    return buildJsonPayload(502, {
      error: 'UsageLimitUpstreamUnavailable',
      message: error instanceof Error ? error.message : String(error),
      hint: 'Check the upstream usage limit URL or switch CLAUDE_USAGE_LIMIT_MODE=sample.'
    });
  }
}

export async function getUsageLimitPayload(env = process.env) {
  const config = resolveUsageLimitConfig(env);

  if (config.mode === 'sample') {
    return buildSamplePayload(config);
  }

  return buildUpstreamPayload(config);
}

export async function sendUsageLimitResponse(response, env = process.env) {
  const payload = await getUsageLimitPayload(env);
  response.writeHead(payload.statusCode, payload.headers);
  response.end(payload.body);
}

export function describeUsageLimitMode(env = process.env) {
  const config = resolveUsageLimitConfig(env);

  if (config.mode === 'sample') {
    return `sample (${config.samplePath})`;
  }

  return `upstream (${config.upstream})`;
}
