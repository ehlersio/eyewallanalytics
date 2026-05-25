// Cloudflare Pages Function — proxies to the Worker's latest notification KV key
// Service worker calls GET /api/notification to get notification details
export async function onRequest(context) {
  const workerUrl = context.env.WORKER_URL;
  if (!workerUrl) {
    return Response.json({ title: 'EyeWall Analytics', body: '' });
  }

  const res = await fetch(`${workerUrl}/cache/latest-notification`).catch(() => null);
  if (!res?.ok) {
    return Response.json({ title: 'EyeWall Analytics', body: 'New update' });
  }

  const data = await res.json();
  return Response.json(data, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
