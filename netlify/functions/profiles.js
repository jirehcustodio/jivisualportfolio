// Netlify Function: profiles (per-account storage)
// Endpoints:
// - GET    /api/profiles/exists?first&last      -> { exists, key }
// - GET    /api/profiles/get?first&last         -> { profile } | 404
// - GET    /api/profiles/list?limit=...         -> { profiles: [summary...] }
// - POST   /api/profiles/upsert                 -> body { first,last, ts?, ua?, ip?, data? }
// - DELETE /api/profiles?first&last             -> admin-only delete

let getStore;
let blobsOk = true;
try {
  const blobs = require('@netlify/blobs');
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN || process.env.BLOBS_TOKEN;
  const looksLikeGuid = typeof siteID === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(siteID);
  const looksLikeToken = typeof token === 'string' && token.startsWith('nfp_');
  if (blobs.createClient && looksLikeGuid && looksLikeToken) {
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

const KEY = 'profiles.json';
const normalize = (s) => (s == null ? '' : String(s)).trim().replace(/[^a-z0-9]/gi, '').toLowerCase();
function keyFor(first, last) { return normalize(first) + ':' + normalize(last); }
function parseUA(ua = '') {
  try {
    const parts = [];
    if (/Windows/i.test(ua)) parts.push('Windows');
    else if (/(Macintosh|Mac OS X)/i.test(ua)) parts.push('macOS');
    else if (/iPhone|iPad|iOS/i.test(ua)) parts.push('iOS');
    else if (/Android/i.test(ua)) parts.push('Android');
    else if (/Linux/i.test(ua)) parts.push('Linux');
    if (/Edg\//i.test(ua)) parts.push('Edge');
    else if (/OPR\//i.test(ua)) parts.push('Opera');
    else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) parts.push('Chrome');
    else if (/Firefox\//i.test(ua)) parts.push('Firefox');
    else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) parts.push('Safari');
    return parts.join(' · ');
  } catch { return ''; }
}

async function loadAll(store) {
  const obj = (await store.get(KEY, { type: 'json' })) || {};
  return (obj && typeof obj === 'object') ? obj : {};
}
async function saveAll(store, obj) {
  await store.set(KEY, JSON.stringify(obj), { contentType: 'application/json' });
}

exports.handler = async function(event) {
  const method = event.httpMethod || 'GET';
  const path = event.path || '';
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS };
  const storageAvailable = blobsOk && typeof getStore === 'function';
  let store = null;
  if (storageAvailable) {
    try { store = getStore('profiles'); } catch { try { store = getStore({ name: 'profiles' }); } catch { store = null; } }
  }

  const qs = event.queryStringParameters || {};
  const first = qs.first || '';
  const last = qs.last || '';
  const k = keyFor(first, last);

  if (method === 'GET') {
    if (/\/profiles\/(exists|get|list)$/.test(path) || path.endsWith('/profiles') || path.includes('/profiles')) {
      if (path.endsWith('/profiles/exists')) {
        if (!store) return { statusCode: 200, headers: CORS, body: JSON.stringify({ exists: false, key: k, note: 'Storage not configured' }) };
        const all = await loadAll(store);
        const exists = !!all[k];
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ exists, key: k }) };
      }
      if (path.endsWith('/profiles/get')) {
        if (!store) return { statusCode: 404, headers: CORS, body: JSON.stringify({ ok: false, error: 'Not found' }) };
        const all = await loadAll(store);
        const profile = all[k];
        if (!profile) return { statusCode: 404, headers: CORS, body: JSON.stringify({ ok: false, error: 'Not found' }) };
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ profile }) };
      }
      if (path.endsWith('/profiles/list') || path.endsWith('/profiles')) {
        if (!store) return { statusCode: 200, headers: CORS, body: JSON.stringify({ profiles: [], note: 'Storage not configured' }) };
        const all = await loadAll(store);
        let list = Object.values(all).map(p => ({
          key: p.key, first: p.first, last: p.last, created: p.created, updated: p.updated,
          lastSeen: p.lastSeen || p.updated, loginCount: p.loginCount || 0,
          entriesCount: p.entriesCount || 0, devices: p.devices || [], lastIP: p.lastIP || ''
        }));
        list.sort((a, b) => (b.updated || 0) - (a.updated || 0));
        const limit = parseInt(qs.limit || '', 10);
        if (!Number.isNaN(limit) && limit > 0) list = list.slice(0, limit);
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ profiles: list }) };
      }
    }
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ ok: false, error: 'Not found' }) };
  }

  if (method === 'POST') {
  if (!event.body) return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'Missing body' }) };
  if (!store) return { statusCode: 503, headers: CORS, body: JSON.stringify({ ok: false, error: 'Storage not configured' }) };
    let body; try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) }; }
    const f = body.first || first;
    const l = body.last || last;
    const key = keyFor(f, l);
    if (!key || key === ':') return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'Missing name' }) };
    const ts = Number(body.ts) || Date.now();
    const ua = (body.ua || event.headers?.['user-agent'] || '');
    const ip = body.ip || event.headers?.['x-nf-client-connection-ip'] || event.headers?.['client-ip'] || (event.headers?.['x-forwarded-for']?.split(',')[0] || '');
    const device = parseUA(ua);
    const all = await loadAll(store);
    const prev = all[key] || { key, first: f, last: l, created: ts, loginCount: 0, entriesCount: 0, devices: [] };
    const next = { ...prev };
    next.updated = ts;
    next.lastSeen = ts;
    next.lastUA = ua;
    next.lastIP = ip;
    if (device) {
      const set = new Set([...(next.devices || []), device]);
      next.devices = Array.from(set).slice(-8);
    }
    // Counters: caller can specify to increment entriesCount; always increment loginCount for upsert events unless suppressed
    if (body.incLogin !== false) next.loginCount = (next.loginCount || 0) + 1;
    if (body.incEntries === true) next.entriesCount = (next.entriesCount || 0) + 1;
    // Merge arbitrary data
    if (body.data && typeof body.data === 'object') {
      next.data = { ...(next.data || {}), ...body.data };
    }
    all[key] = next;
    await saveAll(store, all);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, key, profile: next }) };
  }

  if (method === 'DELETE') {
  if (!store) return { statusCode: 503, headers: CORS, body: JSON.stringify({ ok: false, error: 'Storage not configured' }) };
  const headers = event.headers || {};
    const provided = headers['x-admin-key'] || headers['X-Admin-Key'] || (qs.key) || (qs.admin_key) || (qs.k);
    const ADMIN_KEY = (process.env.ADMIN_KEY || process.env.NTL_ADMIN_KEY || '08/07/2003').trim();
    if (!ADMIN_KEY || normalize(provided) !== normalize(ADMIN_KEY)) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ ok: false, error: 'Forbidden' }) };
    }
    if (!k || k === ':') return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'Missing name' }) };
    const all = await loadAll(store);
    const existed = !!all[k];
    delete all[k];
    await saveAll(store, all);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, removed: existed ? 1 : 0 }) };
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
};
