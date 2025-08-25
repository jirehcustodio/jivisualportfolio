// Netlify Function: get-logins
// GET /.netlify/functions/get-logins -> returns all login records (username -> info)

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
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'content-type': 'application/json'
};

exports.handler = async function(event) {
  const method = event.httpMethod || 'GET';
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (method !== 'GET') return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  let store = null;
  if (blobsOk && typeof getStore === 'function') {
    try { store = getStore('logins'); } catch { try { store = getStore({ name: 'logins' }); } catch { store = null; } }
  }
  if (!store) return { statusCode: 200, headers: CORS, body: JSON.stringify({ logins: {}, note: 'Storage not configured' }) };
  try {
    const listed = await store.list();
    const keys = Array.from(listed?.blobs?.keys?.() || []);
    const out = {};
    for (const k of keys) {
      try { out[k] = await store.get(k, { type: 'json' }); } catch {}
    }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ logins: out }) };
  } catch (e) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ logins: {} }) };
  }
};
