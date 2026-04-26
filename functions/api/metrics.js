import { SAMPLE_METRICS_TEXT } from '../_shared/samples.js';

function resolveMode(env) {
  if (env.CLAUDE_METRICS_MODE === 'upstream') {
    return 'upstream';
  }

  if (env.CLAUDE_METRICS_MODE === 'sample') {
    return 'sample';
  }

  return env.CLAUDE_METRICS_UPSTREAM ? 'upstream' : 'sample';
}

function buildTextResponse(body, source, status = 200, contentType = 'text/plain; charset=utf-8') {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'X-Claude-Metrics-Source': source
    }
  });
}

function buildJsonResponse(payload, source, status = 200) {
  return buildTextResponse(JSON.stringify(payload), source, status, 'application/json; charset=utf-8');
}

export async function onRequestGet(context) {
  const { env } = context;
  const mode = resolveMode(env);

  if (mode === 'sample') {
    return buildTextResponse(SAMPLE_METRICS_TEXT, 'sample');
  }

  const upstream = env.CLAUDE_METRICS_UPSTREAM;

  if (!upstream) {
    return buildJsonResponse(
      {
        error: 'MissingMetricsUpstream',
        message: 'CLAUDE_METRICS_UPSTREAM is not configured.',
        hint: 'Set CLAUDE_METRICS_UPSTREAM or switch CLAUDE_METRICS_MODE=sample.'
      },
      'error',
      500
    );
  }

  try {
    const upstreamResponse = await fetch(upstream, {
      headers: {
        Accept: 'text/plain'
      }
    });
    const body = await upstreamResponse.text();

    return buildTextResponse(
      body,
      'upstream',
      upstreamResponse.status,
      upstreamResponse.headers.get('content-type') || 'text/plain; charset=utf-8'
    );
  } catch (error) {
    return buildJsonResponse(
      {
        error: 'MetricsUpstreamUnavailable',
        message: error instanceof Error ? error.message : String(error),
        hint: 'Check the upstream metrics URL or switch CLAUDE_METRICS_MODE=sample.'
      },
      'error',
      502
    );
  }
}
