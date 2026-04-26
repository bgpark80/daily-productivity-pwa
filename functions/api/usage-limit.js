import { SAMPLE_USAGE_LIMIT } from '../_shared/samples.js';

function resolveMode(env) {
  if (env.CLAUDE_USAGE_LIMIT_MODE === 'upstream') {
    return 'upstream';
  }

  if (env.CLAUDE_USAGE_LIMIT_MODE === 'sample') {
    return 'sample';
  }

  return env.CLAUDE_USAGE_LIMIT_UPSTREAM ? 'upstream' : 'sample';
}

function buildJsonResponse(payload, source, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Claude-Usage-Limit-Source': source
    }
  });
}

export async function onRequestGet(context) {
  const { env } = context;
  const mode = resolveMode(env);

  if (mode === 'sample') {
    return buildJsonResponse(SAMPLE_USAGE_LIMIT, 'sample');
  }

  const upstream = env.CLAUDE_USAGE_LIMIT_UPSTREAM;

  if (!upstream) {
    return buildJsonResponse(
      {
        error: 'MissingUsageLimitUpstream',
        message: 'CLAUDE_USAGE_LIMIT_UPSTREAM is not configured.',
        hint: 'Set CLAUDE_USAGE_LIMIT_UPSTREAM or switch CLAUDE_USAGE_LIMIT_MODE=sample.'
      },
      'error',
      500
    );
  }

  try {
    const upstreamResponse = await fetch(upstream, {
      headers: {
        Accept: 'application/json'
      }
    });
    const body = await upstreamResponse.text();

    return new Response(body, {
      status: upstreamResponse.status,
      headers: {
        'Content-Type': upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Claude-Usage-Limit-Source': 'upstream'
      }
    });
  } catch (error) {
    return buildJsonResponse(
      {
        error: 'UsageLimitUpstreamUnavailable',
        message: error instanceof Error ? error.message : String(error),
        hint: 'Check the upstream usage limit URL or switch CLAUDE_USAGE_LIMIT_MODE=sample.'
      },
      'error',
      502
    );
  }
}
