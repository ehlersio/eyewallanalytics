// functions/api/ai.js
// Cloudflare Pages Function — proxies requests to Anthropic API.
// Injects ANTHROPIC_API_KEY server-side so the key never ships to the browser.
//
// Usage (from frontend):
//   POST /api/ai   →   https://api.anthropic.com/v1/messages
//
// Environment variable required (set in Cloudflare Pages dashboard):
//   ANTHROPIC_API_KEY — same secret already used by the Worker

export async function onRequest(context) {
  const { request, env } = context;

  // Only allow POST
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { type: 'config_error', message: 'ANTHROPIC_API_KEY not configured' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Forward body to Anthropic
  let body;
  try {
    body = await request.text();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body,
  });

  // Return Anthropic's response as-is with CORS headers for browser access
  const responseBody = await response.text();
  return new Response(responseBody, {
    status:  response.status,
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
