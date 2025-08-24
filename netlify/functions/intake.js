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

exports.handler = async function(event, context) {
  const method = event.httpMethod || 'GET';
  const path = event.path || '';
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS };

  if (method === 'POST') {
    let body = null;
    try { body = event.body ? JSON.parse(event.body) : null; } catch { body = null; }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, saved: true, received: body }) };
  }
  if (method === 'GET') {
    if (/\/intake\/(entries|list)$/.test(path) || path.endsWith('/intake/entries')) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ entries: [] }) };
    }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  }
  if (method === 'DELETE') {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  }
  return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
};
