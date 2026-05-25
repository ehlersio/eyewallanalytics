export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname.replace('/nhl-stats', '');
  const target = `https://api.nhle.com${path}${url.search}`;

  const res = await fetch(target, {
    headers: { 'User-Agent': 'EyeWall-Analytics/1.0' },
  });

  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}