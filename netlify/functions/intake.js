// Netlify Function: intake
// Supports:
// - POST   /api/intake                -> accept intake payload and persist
// - GET    /api/intake/entries        -> list all persisted entries
// - DELETE /api/intake?ts=...         -> delete by timestamp (best-effort)

const { getStore } = require('@netlify/blobs');

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization,x-admin-key,X-Admin-Key',
  'content-type': 'application/json'
};

exports.handler = async function(event, context) {
  const method = event.httpMethod || 'GET';
  const path = event.path || '';
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS };

  // Blobs store for this site; key 'entries.json' holds an array of records
  const store = getStore('intake');
  const KEY = 'entries.json';

  if (method === 'POST') {
    let body = null;
    try { body = event.body ? JSON.parse(event.body) : null; } catch { body = null; }
    if (!body || typeof body !== 'object') {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) };
    }
    const ts = Date.now();
    const ua = (event.headers?.['user-agent']) || '';
    const ip = event.headers?.['x-nf-client-connection-ip'] || event.headers?.['client-ip'] || (event.headers?.['x-forwarded-for']?.split(',')[0] || '');
    const rec = { ...body, ts, ua, ip };
    try {
      const existing = (await store.get(KEY, { type: 'json' })) || [];
      existing.push(rec);
      await store.set(KEY, JSON.stringify(existing), { contentType: 'application/json' });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, saved: true, ts }) };
    } catch (e) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok: false, error: 'Persist failed' }) };
    }
  }

  if (method === 'GET') {
    if (/\/intake\/(entries|list)$/.test(path) || path.endsWith('/intake/entries')) {
      // Admin-only: require x-admin-key header (or ?key= / ?admin_key= fallback)
      const headers = event.headers || {};
      const provided = headers['x-admin-key'] || headers['X-Admin-Key'] || (event.queryStringParameters?.key) || (event.queryStringParameters?.admin_key);
      const ADMIN_KEY = (process.env.ADMIN_KEY || process.env.NTL_ADMIN_KEY || '').trim();
      if (!ADMIN_KEY || provided !== ADMIN_KEY) {
        return { statusCode: 403, headers: CORS, body: JSON.stringify({ ok:false, error: 'Forbidden' }) };
      }
      try {
        const entries = (await store.get(KEY, { type: 'json' })) || [];
        // newest first
        entries.sort((a,b) => (b.ts||0) - (a.ts||0));
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ entries }) };
      } catch (e) {
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ entries: [] }) };
      }
    }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  }

  if (method === 'DELETE') {
    // Admin-only
  const headers = event.headers || {};
  const provided = headers['x-admin-key'] || headers['X-Admin-Key'] || (event.queryStringParameters?.key) || (event.queryStringParameters?.admin_key);
  const ADMIN_KEY = (process.env.ADMIN_KEY || process.env.NTL_ADMIN_KEY || '').trim();
    if (!ADMIN_KEY || provided !== ADMIN_KEY) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ ok:false, error: 'Forbidden' }) };
    }
    // delete by timestamp query ?ts=...
    const ts = parseInt((event.queryStringParameters?.ts) || '', 10);
    if (!ts) return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'Missing ts' }) };
    try {
      const existing = (await store.get(KEY, { type: 'json' })) || [];
      const next = existing.filter(e => e.ts !== ts);
      await store.set(KEY, JSON.stringify(next), { contentType: 'application/json' });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, removed: existing.length - next.length }) };
    } catch (e) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok: false, error: 'Delete failed' }) };
    }
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
};
