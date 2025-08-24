// Netlify Function: intake
// Supports:
// - POST   /api/intake                -> accept intake payload
// - GET    /api/intake/entries        -> list entries (stubbed empty)
// - DELETE /api/intake?ts=...         -> delete by timestamp (stubbed ok)

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'content-type': 'application/json'
};

export default async (req, context) => {
  const { method } = req;
  const url = new URL(req.url);
  const path = url.pathname; // includes /api/intake and possible suffix

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  // Minimal stub behavior to avoid network errors in production
  if (method === 'POST') {
    let body = null;
    try { body = await req.json(); } catch {}
    const saved = true; // stub: acknowledge
    return new Response(JSON.stringify({ ok: true, saved, received: body || null }), { status: 200, headers: CORS });
  }

  if (method === 'GET') {
    if (/\/intake\/(entries|list)$/.test(path) || path.endsWith('/intake/entries')) {
      return new Response(JSON.stringify({ entries: [] }), { status: 200, headers: CORS });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
  }

  if (method === 'DELETE') {
    // Accept ts param and return ok
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
  }

  return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405, headers: CORS });
};
