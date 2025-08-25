// Netlify Function: diag
// Purpose: Quick readiness check for functions routing, env/provider presence, and blobs availability.
// Safe output (no secrets); accessible at /.netlify/functions/diag and /api/diag

exports.handler = async function(event) {
  const method = event.httpMethod || 'GET';
  if (method === 'OPTIONS') return { statusCode: 204, headers: cors() };
  if (method !== 'GET') return { statusCode: 405, headers: cors(), body: json({ ok: false, error: 'Method not allowed' }) };

  const env = process.env || {};
  const has = (k) => typeof env[k] === 'string' && env[k].trim().length > 0;

  // Check provider presence without leaking actual values
  const sendgrid = { present: has('SENDGRID_API_KEY'), fromSet: has('CONTACT_FROM_EMAIL') || has('SENDGRID_FROM') };
  const resend = { present: has('RESEND_API_KEY'), fromSet: has('RESEND_FROM') || has('CONTACT_FROM_EMAIL') };
  const contactTo = { present: has('CONTACT_TO_EMAIL') || has('CONTACT_TO') };

  // Blobs readiness
  let blobs = { available: false, mode: 'unknown' };
  try {
    const blobsMod = require('@netlify/blobs');
    const siteID = env.NETLIFY_SITE_ID || env.SITE_ID || env.BLOBS_SITE_ID;
    const token = env.NETLIFY_BLOBS_TOKEN || env.NETLIFY_API_TOKEN || env.BLOBS_TOKEN;
    const looksGuid = typeof siteID === 'string' && /^[0-9a-f-]{36}$/i.test(siteID);
    const looksToken = typeof token === 'string' && token.startsWith('nfp_');
    let getStore;
    if (blobsMod.createClient && looksGuid && looksToken) {
      const client = blobsMod.createClient({ siteID, token });
      getStore = client.getStore.bind(client);
      blobs.mode = 'client';
    } else {
      getStore = blobsMod.getStore;
      blobs.mode = 'direct';
    }
    const store = getStore && (getStore('contact') || getStore({ name: 'contact' }));
    blobs.available = !!store;
  } catch (e) {
    blobs.available = false;
  }

  const out = {
    ok: true,
    time: new Date().toISOString(),
    runtime: {
      node: process.version,
      netlify: !!env.NETLIFY,
    },
    env: {
      contactTo,
      sendgrid,
      resend,
    },
    blobs,
    routes: {
      contact: '/.netlify/functions/contact',
      hello: '/.netlify/functions/hello',
    }
  };
  return { statusCode: 200, headers: cors(), body: json(out) };
};

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'content-type': 'application/json'
  };
}
function json(obj) { return JSON.stringify(obj); }
