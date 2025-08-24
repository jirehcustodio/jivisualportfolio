// Echo Netlify Function: replies with method, path, query, and JSON body
// GET /api/echo?x=1 -> { ok: true, method:"GET", query:{x:"1"}, body:null }
// POST /api/echo {"name":"Ji"} -> echoes body

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
  "content-type": "application/json"
};

export default async (req, context) => {
  const { method } = req;
  const url = new URL(req.url);

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  let body = null;
  if (method !== "GET") {
    try {
      body = await req.json();
    } catch (_) {
      body = null;
    }
  }

  const res = {
    ok: true,
    method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    body
  };

  return new Response(JSON.stringify(res), { status: 200, headers: cors });
};
