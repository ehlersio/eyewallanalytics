export async function onRequest(context) {
  const url  = new URL(context.request.url);
  const path = url.pathname.replace('/nhl-assets', '') || '/';
  const target = `https://assets.nhle.com${path}${url.search}`;

  const res = await fetch(target, { redirect: 'follow' });

  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type':                res.headers.get('Content-Type') || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control':               'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
