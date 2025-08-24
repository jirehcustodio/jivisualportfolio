// Netlify Function: profiles
// GET /api/profiles/exists?first=...&last=...

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'content-type': 'application/json'
};

exports.handler = async function(event, context) {
  const method = event.httpMethod || 'GET';
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (method !== 'GET') return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  const qs = event.queryStringParameters || {};
  const first = qs.first || '';
  const last = qs.last || '';
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ exists: false, first, last }) };
};
