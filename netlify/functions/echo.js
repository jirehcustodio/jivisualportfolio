// Echo Netlify Function: replies with method, path, query, and JSON body
// GET /api/echo?x=1 -> { ok: true, method:"GET", query:{x:"1"}, body:null }
// POST /api/echo {"name":"Ji"} -> echoes body

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
  "content-type": "application/json"
};

exports.handler = async function(event, context) {
  const method = event.httpMethod || 'GET';
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: cors };
  }
  let body = null;
  if (method !== 'GET' && event.body) {
    try { body = JSON.parse(event.body); } catch (_) { body = null; }
  }
  // Parse query
  const query = event.queryStringParameters || {};
  const path = event.path || '';
  const res = { ok: true, method, path, query, body };
  return { statusCode: 200, headers: cors, body: JSON.stringify(res) };
};
