// Netlify Function: feedback.js
// Handles POST (add feedback) and GET (list feedbacks)

const fs = require('fs');
const path = require('path');
const FEEDBACK_FILE = path.join(__dirname, 'feedbacks.json');

function readFeedbacks() {
  try {
    if (!fs.existsSync(FEEDBACK_FILE)) return [];
    return JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeFeedbacks(feedbacks) {
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedbacks, null, 2));
}

exports.handler = async function(event) {
  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: 'Invalid JSON' }; }
    const { text, stars } = body;
    if (!text || typeof stars !== 'number' || stars < 1 || stars > 5) {
      return { statusCode: 400, body: 'Missing or invalid fields' };
    }
    const feedbacks = readFeedbacks();
    feedbacks.push({ text, stars, ts: Date.now() });
    writeFeedbacks(feedbacks);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }
  if (event.httpMethod === 'GET') {
    const feedbacks = readFeedbacks();
    return {
      statusCode: 200,
      body: JSON.stringify({ feedbacks }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
  return { statusCode: 405, body: 'Method Not Allowed' };
};
