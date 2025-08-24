// Simple Netlify Function example (CommonJS)
// Accessible at /.netlify/functions/hello and via /api/hello
exports.handler = async function(event, context) {
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    body: JSON.stringify({ message: 'Hello from Netlify Functions', time: new Date().toISOString() })
  };
};
