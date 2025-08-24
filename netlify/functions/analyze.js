// Analyze function (stub) for demo-resume-analyzer
// Accepts multipart/form-data (ignored) and returns a fake analysis JSON
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
  // We don’t need to parse the file for the demo; return a deterministic stub
  const now = new Date().toISOString();
  const sample = {
    text: 'Sample extracted text from your resume (demo).',
    score: 82,
    feedback: 'Clear structure and strong skills. Consider adding quantified achievements and link to recent projects.',
    hfResult: [ { label: 'POSITIVE', score: 0.92 } ],
    roleFit: { role: 'frontend', match: 76 },
    explain: { present: ['JavaScript','React','HTML','CSS','Git'], missing: ['Testing','Accessibility','CI/CD'] },
    ts: now
  };
  return { statusCode: 200, headers: CORS, body: JSON.stringify(sample) };
};
