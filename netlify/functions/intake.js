// Netlify Function: intake
// Supports:
// - POST   /api/intake                -> accept intake payload and persist
// - GET    /api/intake/entries        -> list all persisted entries
// - DELETE /api/intake?ts=...         -> delete by timestamp (best-effort)

let getStore;
let blobsOk = true;
try {
  const blobs = require('@netlify/blobs');
  // If explicit credentials provided, create a client manually; else rely on Netlify env
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN || process.env.BLOBS_TOKEN;
  if (blobs.createClient && siteID && token) {
    const client = blobs.createClient({ siteID, token });
    getStore = client.getStore.bind(client);
  } else {
    getStore = blobs.getStore;
  }
} catch (e) {
  blobsOk = false;
}

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
  const store = blobsOk && typeof getStore === 'function' ? getStore('intake') : null;
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
    if (!store) {
      return { statusCode: 503, headers: CORS, body: JSON.stringify({ ok: false, error: 'Storage not configured (missing @netlify/blobs). Please set Functions directory and install deps.' }) };
    }
    try {
      const existing = (await store.get(KEY, { type: 'json' })) || [];
      existing.push(rec);
      await store.set(KEY, JSON.stringify(existing), { contentType: 'application/json' });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, saved: true, ts }) };
    } catch (e) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok: false, error: 'Persist failed' }) };
    }
  }

  // Helper: normalize keys to avoid formatting mismatches
  const normalize = (s) => (s == null ? '' : String(s)).trim().replace(/[^a-z0-9]/gi, '').toLowerCase();

  if (method === 'GET') {
  if (/\/intake\/(entries|list)$/.test(path) || path.endsWith('/intake/entries') || (path.endsWith('/intake') && ((event.queryStringParameters?.list === '1') || (event.queryStringParameters?.entries === '1')))) {
      // Public: list entries, newest first; supports optional limit and since filters
      try {
        if (!store) return { statusCode: 200, headers: CORS, body: JSON.stringify({ entries: [], note: 'Storage not configured on server.' }) };
        let entries = (await store.get(KEY, { type: 'json' })) || [];
        // newest first
        entries.sort((a,b) => (b.ts||0) - (a.ts||0));
        const qs = event.queryStringParameters || {};
        const since = parseInt(qs.since || '', 10);
        if (!Number.isNaN(since) && since > 0) {
          entries = entries.filter(e => (e.ts || 0) >= since);
        }
        const limit = parseInt(qs.limit || '', 10);
        if (!Number.isNaN(limit) && limit > 0) {
          entries = entries.slice(0, limit);
        }
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ entries }) };
      } catch (e) {
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ entries: [] }) };
      }
    }
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, blobs: !!store }) };
  }

  if (method === 'DELETE') {
    // Admin-only
  const headers = event.headers || {};
  const provided = headers['x-admin-key'] || headers['X-Admin-Key'] || (event.queryStringParameters?.key) || (event.queryStringParameters?.admin_key) || (event.queryStringParameters?.k);
  const ADMIN_KEY = (process.env.ADMIN_KEY || process.env.NTL_ADMIN_KEY || '08/07/2003').trim();
  if (!ADMIN_KEY || normalize(provided) !== normalize(ADMIN_KEY)) {
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
