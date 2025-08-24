// Netlify Function: profiles
// GET /api/profiles/exists?first=...&last=...

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'content-type': 'application/json'
};

export default async (req, context) => {
  const { method } = req;
  const url = new URL(req.url);
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (method !== 'GET') return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405, headers: CORS });
  const first = url.searchParams.get('first') || '';
  const last = url.searchParams.get('last') || '';
  // Stub: always false in serverless demo
  return new Response(JSON.stringify({ exists: false, first, last }), { status: 200, headers: CORS });
};
