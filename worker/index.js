// Cloudflare Worker: counts a few anonymous events, serves everything else from the static assets. Stores no names, no IP, no cookies.
export const EVENTS = ['visit', 'play', 'death', 'fly', 'drive', 'eat', 'festival'];

export async function handleEvent(req, env) {
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  const len = Number(req.headers.get('content-length') || 0);
  if (len > 200) return new Response(null, { status: 413 });
  const text = await req.text();
  if (text.length > 200) return new Response(null, { status: 413 }); // the header can lie or be missing
  let e;
  try { e = JSON.parse(text).e; } catch { return new Response(null, { status: 400 }); }
  if (!EVENTS.includes(e)) return new Response(null, { status: 400 });
  try { env.EVENTS?.writeDataPoint({ blobs: [e], doubles: [1], indexes: [e] }); } catch { /* counting is best effort */ }
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

export default {
  fetch(req, env) {
    return new URL(req.url).pathname === '/api/event' ? handleEvent(req, env) : env.ASSETS.fetch(req);
  },
};
