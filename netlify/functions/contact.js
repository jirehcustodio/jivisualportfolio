// Contact function: accepts JSON { name, email, message, page }
// Persists messages to Netlify Blobs and exposes an admin-protected GET for listing.

let getStore;
let blobsOk = true;
try {
  const blobs = require('@netlify/blobs');
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || process.env.BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN || process.env.BLOBS_TOKEN;
  const looksLikeGuid = typeof siteID === 'string' && /^[0-9a-f-]{36}$/i.test(siteID);
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
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization,x-admin-key,X-Admin-Key',
  'content-type': 'application/json'
};

function normalize(s){ return (s==null?'':String(s)).trim().toLowerCase(); }
function isValidEmail(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s||'').trim()); }

exports.handler = async function(event) {
  const method = event.httpMethod || 'GET';
  const path = event.path || '';
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS };

  // Store
  let store = null;
  if (blobsOk && typeof getStore === 'function') {
    try { store = getStore('contact'); } catch (_) { try { store = getStore({ name: 'contact' }); } catch { store = null; } }
  }
  const KEY = 'messages.json';

  if (method === 'POST') {
    let body = {};
    try { body = event.body ? JSON.parse(event.body) : {}; } catch {}

    // Basic honeypot (bots often fill hidden fields like 'website')
    if (body.website || body.honey) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, spam: true }) };
    }

    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const message = String(body.message || '').trim();
    const page = String(body.page || '').trim();
    if (!name || !email || !message) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok:false, error: 'Missing fields' }) };
    }
    if (!isValidEmail(email)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok:false, error: 'Invalid email' }) };
    }
    if (message.length > 4000) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok:false, error: 'Message too long' }) };
    }

    const ts = Date.now();
    const ua = (event.headers?.['user-agent']) || '';
    const ip = event.headers?.['x-nf-client-connection-ip'] || event.headers?.['client-ip'] || (event.headers?.['x-forwarded-for']?.split(',')[0] || '');
    const rec = { ts, name, email, message, page, ua, ip };

    if (!store) {
      // Accept but warn client storage not configured
      return { statusCode: 202, headers: CORS, body: JSON.stringify({ ok: true, saved: false, note: 'Storage unavailable' }) };
    }
    try {
      const existing = (await store.get(KEY, { type: 'json' })) || [];
      existing.push(rec);
      await store.set(KEY, JSON.stringify(existing), { contentType: 'application/json' });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, saved: true, ts }) };
    } catch (e) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok:false, error: 'Persist failed' }) };
    }
  }

  if (method === 'GET') {
    // Admin-only list: /contact/messages or /contact?list=1
    const headers = event.headers || {};
    const provided = headers['x-admin-key'] || headers['X-Admin-Key'] || (event.queryStringParameters?.key) || (event.queryStringParameters?.admin_key);
    const ADMIN_KEY = (process.env.ADMIN_KEY || process.env.NTL_ADMIN_KEY || '08/07/2003').trim();
    if (!ADMIN_KEY || normalize(provided) !== normalize(ADMIN_KEY)) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ ok:false, error: 'Forbidden' }) };
    }
    if (!store) return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok:true, messages: [] }) };
    try {
      let messages = (await store.get(KEY, { type: 'json' })) || [];
      messages.sort((a,b) => (b.ts||0) - (a.ts||0));
      const limit = parseInt(event.queryStringParameters?.limit || '', 10);
      if (!isNaN(limit) && limit > 0) messages = messages.slice(0, limit);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok:true, messages }) };
    } catch {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok:true, messages: [] }) };
    }
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok:false, error: 'Method not allowed' }) };
};
