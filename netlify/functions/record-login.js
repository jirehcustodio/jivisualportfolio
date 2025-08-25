// Netlify Function: record-login
// POST /.netlify/functions/record-login { username }
// Stores last login info per username in Netlify Blobs store "logins"

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
} catch (e) { blobsOk = false; }

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'content-type': 'application/json'
};

const normalize = (s) => (s == null ? '' : String(s)).trim().replace(/[^a-z0-9]/gi, '').toLowerCase();

exports.handler = async function(event) {
  const method = event.httpMethod || 'GET';
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS };
  let store = null;
  if (blobsOk && typeof getStore === 'function') {
    try { store = getStore('logins'); } catch { try { store = getStore({ name: 'logins' }); } catch { store = null; } }
  }
  if (method === 'GET') {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, blobs: !!store }) };
  }
  if (method !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  if (!store) return { statusCode: 503, headers: CORS, body: JSON.stringify({ ok: false, error: 'Storage not configured' }) };
  let body; try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  let username = body.username || body.name || '';
  if (!username && body.first && body.last) username = `${body.first} ${body.last}`;
  const key = normalize(username);
  if (!key) return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: 'Missing username' }) };
  const ts = Date.now();
  const docKey = key; // simple key per user
  try {
    let current = {};
    try { current = await store.get(docKey, { type: 'json' }); } catch { current = {}; }
    const count = Number(current?.count || 0) + 1;
    const ua = event.headers?.['user-agent'] || '';
    const ip = event.headers?.['x-nf-client-connection-ip'] || event.headers?.['client-ip'] || (event.headers?.['x-forwarded-for']?.split(',')[0] || '');
    const value = { username, lastLogin: ts, count, ua, ip };
    await store.set(docKey, JSON.stringify(value), { contentType: 'application/json' });
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, saved: true, username, ts }) };
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok: false, error: 'Persist failed' }) };
  }
};
