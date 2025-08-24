// Contact function: accepts JSON { name, email, message, page }
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'content-type': 'application/json'
};

exports.handler = async function(event) {
  const method = event.httpMethod || 'GET';
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS };
  if (method !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch {}
  // In a real app: send email or store in DB
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
};
